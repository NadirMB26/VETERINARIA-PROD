/**
 * Cloud Functions — Veterinaria Canes
 *
 * actualizarCredenciales:
 *   Permite que un administrador activo cambie el correo y/o la contraseña
 *   de cualquier usuario del sistema (Auth), cosa que el SDK del cliente no
 *   puede hacer por sí solo.
 *
 * migrarHistorialClinico:
 *   Convierte los diagnósticos legados (`citas/{idCita}/diagnosticos/diagnostico`)
 *   en RegistroClínico (Fase 1). El SDK de admin ignora las reglas de Firestore,
 *   por lo que ningún rol del cliente necesita permiso de escritura clínica.
 *   Es idempotente y corre una sola vez (marca `_meta/historialMigrado`).
 *
 * Despliegue:
 *   cd functions && npm install
 *   firebase login
 *   firebase deploy --only functions
 */
const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Mapeo tipo de cita → categoría clínica (Fase 1).
const CATEGORIA_POR_TIPO = {
  'Consulta general': 'DIAGNOSTICO',
  Vacunación: 'PREVENTIVO',
  Cirugía: 'QUIRURGICO',
  Urgencia: 'EMERGENCIA',
  Control: 'PREVENTIVO',
  Otro: 'DIAGNOSTICO',
  Estética: 'ESTETICA',
};

const LEGADO_REF = (idCita) => `citas/${idCita}/diagnosticos/diagnostico`;

exports.actualizarCredenciales = functions.https.onCall(async (data, context) => {
  // 1) Debe haber una sesión iniciada.
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Debes iniciar sesión');
  }

  // 2) Solo un administrador ACTIVO puede cambiar credenciales.
  const callerUid = context.auth.uid;
  const adminSnap = await admin
    .firestore()
    .doc(`administradores/${callerUid}`)
    .get();

  if (!adminSnap.exists || adminSnap.data().estado !== 'activo') {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Solo un administrador activo puede cambiar credenciales'
    );
  }

  // 3) Validar parámetros.
  const { uid, email, password } = data || {};

  if (!uid || typeof uid !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'El uid del usuario es obligatorio');
  }

  const cambios = {};

  if (email !== undefined && email !== null && email !== '') {
    if (typeof email !== 'string' || !EMAIL_REGEX.test(email)) {
      throw new functions.https.HttpsError('invalid-argument', 'El correo no es válido');
    }
    cambios.email = email;
  }

  if (password !== undefined && password !== null && password !== '') {
    if (typeof password !== 'string' || password.length < 6) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'La contraseña debe tener al menos 6 caracteres'
      );
    }
    cambios.password = password;
  }

  if (Object.keys(cambios).length === 0) {
    throw new functions.https.HttpsError('invalid-argument', 'No hay credenciales para actualizar');
  }

  // 4) Aplicar cambios en Firebase Auth.
  try {
    await admin.auth().updateUser(uid, cambios);
  } catch (err) {
    const code = err && err.code ? err.code : '';
    if (code === 'auth/email-already-in-use') {
      throw new functions.https.HttpsError('already-exists', 'Ese correo ya está en uso por otro usuario');
    }
    if (code === 'auth/weak-password') {
      throw new functions.https.HttpsError('invalid-argument', 'La contraseña debe tener al menos 6 caracteres');
    }
    if (code === 'auth/user-not-found') {
      throw new functions.https.HttpsError('not-found', 'El usuario no existe en Authentication');
    }
    throw new functions.https.HttpsError('internal', err.message || 'Error al actualizar credenciales');
  }

  return { ok: true };
});

exports.migrarHistorialClinico = functions.https.onCall(async (data, context) => {
  // 1) Debe haber una sesión iniciada.
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Debes iniciar sesión');
  }

  // 2) Solo personal ACTIVO del establecimiento puede dispararla.
  const callerUid = context.auth.uid;
  const firestore = admin.firestore();
  const coleccionesRol = ['administradores', 'recepcionistas', 'veterinarios'];
  let autorizado = false;
  for (const col of coleccionesRol) {
    const snap = await firestore.doc(`${col}/${callerUid}`).get();
    if (snap.exists && snap.data().estado === 'activo') {
      autorizado = true;
      break;
    }
  }
  if (!autorizado) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Solo personal activo puede ejecutar la migración'
    );
  }

  // 3) Idempotente: si ya se migró, no vuelve a correr.
  const metaRef = firestore.doc('_meta/historialMigrado');
  const metaSnap = await metaRef.get();
  if (metaSnap.exists && metaSnap.data().hecha === true) {
    return { yaMigrada: true, totalCreados: 0 };
  }

  // 4) Índice de citas y de registros ya existentes (evita duplicados).
  const [citasSnap, registrosSnap] = await Promise.all([
    firestore.collection('citas').get(),
    firestore.collection('registrosClinicos').get(),
  ]);
  const idCitasConRegistro = new Set(registrosSnap.docs.map(d => d.data().idCita).filter(Boolean));

  const citas = new Map();
  citasSnap.forEach(d => citas.set(d.id, d.data()));

  const pendientes = [];
  const ahora = new Date().toISOString();

  for (const [idCita, cita] of citas.entries()) {
    if (idCitasConRegistro.has(idCita)) continue;

    const legadoSnap = await firestore.doc(LEGADO_REF(idCita)).get();
    if (!legadoSnap.exists) continue;

    const diag = legadoSnap.data() || {};

    // Solo migra si el diagnóstico tiene contenido mínimo.
    if (!(diag.sintomas || diag.diagnostico || diag.tratamiento)) continue;

    const categoria = CATEGORIA_POR_TIPO[cita.tipo] || 'DIAGNOSTICO';

    // Estética no genera RegistroClínico (flujo operativo, Fase 2).
    if (categoria === 'ESTETICA') continue;

    const fecha = diag.fechaDiagnostico || diag.fechaActualizacion || ahora;

    pendientes.push({
      idMascota: cita.idMascota || '',
      idCliente: cita.idCliente || '',
      idCita,
      categoria,
      anamnesis: diag.sintomas || '',
      examenFisico: diag.examenFisico || '',
      diagnostico: diag.diagnostico || '',
      tratamiento: diag.tratamiento || '',
      medicamentos: diag.medicamentos || '',
      observaciones: diag.observaciones || '',
      idVeterinario: diag.idVeterinario || cita.idVeterinario || '',
      nombreVeterinario: diag.nombreVeterinario || cita.nombreVeterinario || '',
      fechaRegistro: fecha,
      fechaActualizacion: fecha,
    });
  }

  // 5) Crear los registros en lotes (500 por batch).
  let totalCreados = 0;
  const colRegistros = firestore.collection('registrosClinicos');
  for (let i = 0; i < pendientes.length; i += 500) {
    const batch = firestore.batch();
    const lote = pendientes.slice(i, i + 500);
    for (const reg of lote) {
      batch.set(colRegistros.doc(), reg);
    }
    await batch.commit();
    totalCreados += lote.length;
  }

  // 6) Marcar como migrada.
  await metaRef.set({ hecha: true, fecha: ahora, totalCreados, totalLegados: pendientes.length });

  return { yaMigrada: false, totalCreados };
});
