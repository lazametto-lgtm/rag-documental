// Dataset ficticio de prueba (claramente marcado como DEMO).
// Tres tipos: balance contable, contrato legal, normativa vigente.
// NO contiene datos reales sensibles.

import type { IngestInput } from './ingester';

export const SAMPLE_DOCUMENTS: IngestInput[] = [
  // ───────────────────────── 1. BALANCE CONTABLE ─────────────────────────
  {
    title: 'Balance General DemoCorp S.A. — Ejercicio 2023 (DEMO)',
    docType: 'BALANCE',
    jurisdiction: 'AR',
    entity: 'DemoCorp S.A.',
    period: 'Ejercicio 2023 (01-01-2023 a 31-12-2023)',
    version: 'v1.0 — Auditado',
    validityDate: '2024-03-15',
    status: 'VIGENT',
    collectionName: 'balances-2023',
    sourcePath: 'demo://balances/democorp-balance-2023.pdf',
    pageCount: 3,
    rawText: `Balance General DemoCorp S.A.
Ejercicio anual cerrado al 31 de diciembre de 2023.
Moneda: pesos argentinos (ARS). Unidades: miles de pesos.

Página 1

ESTADO DE SITUACIÓN PATRIMONIAL
| ACTIVO | 31-12-2023 | 31-12-2022 |
| Activo Corriente | | |
| Caja y bancos | 12.500 | 8.200 |
| Inversiones temporales | 5.000 | 3.000 |
| Créditos por ventas | 28.000 | 22.000 |
| Bienes de cambio | 18.000 | 15.000 |
| Total Activo Corriente | 63.500 | 48.200 |
| Activo No Corriente | | |
| Bienes de uso | 45.000 | 40.000 |
| Inversiones permanentes | 10.000 | 10.000 |
| Total Activo No Corriente | 55.000 | 50.000 |
| TOTAL ACTIVO | 118.500 | 98.200 |

Página 2

ESTADO DE SITUACIÓN PATRIMONIAL (continuación)
| PASIVO Y PATRIMONIO | 31-12-2023 | 31-12-2022 |
| Pasivo Corriente | | |
| Deudas comerciales | 14.000 | 11.000 |
| Deudas fiscales | 6.500 | 5.000 |
| Deudas laborales | 3.500 | 2.800 |
| Total Pasivo Corriente | 24.000 | 18.800 |
| Pasivo No Corriente | | |
| Préstamos bancarios largo plazo | 20.000 | 25.000 |
| Total Pasivo No Corriente | 20.000 | 25.000 |
| TOTAL PASIVO | 44.000 | 43.800 |
| PATRIMONIO NETO | | |
| Capital social | 50.000 | 50.000 |
| Reservas | 12.000 | 4.400 |
| Resultados acumulados | 12.500 | 0 |
| TOTAL PATRIMONIO NETO | 74.500 | 54.400 |
| TOTAL PASIVO + PATRIMONIO | 118.500 | 98.200 |

Página 3

ESTADO DE RESULTADOS — Ejercicio 2023
| CONCEPTO | Importe (miles ARS) |
| Ventas netas | 92.000 |
| Costo de mercadería vendida | (58.000) |
| Ganancia bruta | 34.000 |
| Gastos de comercialización | (8.000) |
| Gastos de administración | (6.500) |
| Resultado operativo | 19.500 |
| Resultado financiero | (2.000) |
| RESULTADO NETO DEL EJERCICIO | 17.500 |

Notas al pie:
1) Las cifras se expresan en miles de pesos argentinos (ARS).
2) El activo total al 31-12-2023 asciende a $118.500 miles.
3) El pasivo total al 31-12-2023 asciende a $44.000 miles.
4) El patrimonio neto al 31-12-2023 asciende a $74.500 miles.
5) El resultado neto del ejercicio 2023 es de $17.500 miles (positivo).
6) Auditoría externa: Auditor Demo & Asoc., informe sin salvedades emitido el 15-03-2024.

DEMO — DOCUMENTO FICTICIO DE PRUEBA, NO REPRESENTA DATOS REALES.`,
  },

  // ───────────────────────── 2. CONTRATO LEGAL ─────────────────────────
  {
    title: 'Contrato de Prestación de Servicios DemoCorp-AlphaTech (DEMO)',
    docType: 'CONTRACT',
    jurisdiction: 'AR',
    entity: 'DemoCorp S.A. y AlphaTech S.R.L.',
    period: '2024-2026',
    version: 'v2.1',
    validityDate: '2024-01-15',
    status: 'VIGENT',
    collectionName: 'contratos-comerciales',
    sourcePath: 'demo://contratos/democorp-alphatech-servicios.pdf',
    pageCount: 2,
    rawText: `CONTRATO DE PRESTACIÓN DE SERVICIOS

Entre DemoCorp S.A., CUIT 30-99999999-9, con domicilio en Av. Demo 1234, Ciudad Autónoma de Buenos Aires, en adelante "el Cliente"; y AlphaTech S.R.L., CUIT 30-77777777-7, con domicilio en Calle Prueba 567, Ciudad Autónoma de Buenos Aires, en adelante "el Proveedor"; acuerdan:

Página 1

Cláusula Primera — Objeto.
El Proveedor se obliga a prestar al Cliente servicios de desarrollo y mantenimiento de software a medida, según las especificaciones técnicas detalladas en el Anexo I, que forma parte integrante del presente contrato.

Cláusula Segunda — Plazo.
El plazo de vigencia del presente contrato es de veinticuatro (24) meses contados a partir de la fecha de firma, es decir desde el 15 de enero de 2024 hasta el 15 de enero de 2026. El contrato podrá prorrogarse por acuerdo expreso de las partes.

Cláusula Tercera — Precio y Forma de Pago.
El precio mensual de los servicios asciende a la suma de $500.000 ARS (quinientos mil pesos argentinos) más IVA. El pago se efectuará los días 10 de cada mes mediante transferencia bancaria a la cuenta del Proveedor. El precio se actualizará trimestralmente según el Índice de Precios al Consumidor (IPC) publicado por INDEC.

Cláusula Cuarta — Obligaciones del Proveedor.
a) Prestar los servicios con diligencia y de conformidad con las buenas prácticas de la industria.
b) Asignar un equipo de al menos tres (3) profesionales con experiencia comprobable.
c) Garantizar una disponibilidad del servicio (SLA) del 99,5% mensual.
d) Mantener confidencialidad de la información del Cliente por el plazo de vigencia y durante los cinco (5) años posteriores.

Cláusula Quinta — Obligaciones del Cliente.
a) Proveer la información necesaria para la ejecución del contrato.
b) Efectuar los pagos en término. En caso de mora, el Proveedor podrá suspender los servicios previa intimación fehaciente con plazo de diez (10) días corridos.
c) Designar un responsable de proyecto como único punto de contacto formal.

Página 2

Cláusula Sexta — Penalidades.
El incumplimiento del SLA por parte del Proveedor dará lugar a una penalidad equivalente al 5% del precio mensual por cada 0,5% de incumplimiento, hasta un máximo del 25% mensual.

Cláusula Séptima — Resolución.
Cualquiera de las partes podrá resolver el contrato en caso de incumplimiento grave de la contraparte, previa intimación fehaciente con plazo de treinta (30) días corridos. Será causal de resolución directa el concurso preventivo o quiebra de cualquiera de las partes.

Cláusula Octava — Confidencialidad y Propiedad Intelectual.
La propiedad intelectual sobre los desarrollos realizados en el marco del presente contrato corresponde al Cliente una vez pagado el total del precio. El Proveedor retiene los derechos sobre know-how preexistente.

Cláusula Novena — Jurisdicción y Ley Aplicable.
El presente contrato se rige por las leyes de la República Argentina. Para cualquier divergencia, las partes se someten a la jurisdicción de los Tribunales Nacionales en lo Comercial con asiento en la Ciudad Autónoma de Buenos Aires, renunciando a cualquier otro fuero.

Cláusula Décima — Domicilios y Notificaciones.
Las notificaciones se cursarán a los domicilios constituidos en el encabezamiento. Tendrán pleno valor las notificaciones por correo electrónico certificadas.

Firmado en Buenos Aires, a los 15 días del mes de enero de 2024.

DEMO — DOCUMENTO FICTICIO DE PRUEBA, NO REPRESENTA DATOS REALES.`,
  },

  // ───────────────────────── 3. NORMATIVA VIGENTE ─────────────────────────
  {
    title: 'Ley Nacional de Protección de Datos Personales (DEMO N° 25.326)',
    docType: 'REGULATION',
    jurisdiction: 'AR',
    entity: 'Honorable Congreso de la Nación Argentina',
    period: 'Vigente desde 2001 (modificada 2023)',
    version: 'Texto ordenado 2023',
    validityDate: '2023-12-01',
    status: 'VIGENT',
    collectionName: 'normativas-argentinas',
    sourcePath: 'demo://normativas/ley-25-326-demo.pdf',
    pageCount: 2,
    rawText: `LEY 25.326 (DEMO) — PROTECCIÓN DE DATOS PERSONALES

Sancionada: 4 de octubre de 2001. Promulgada: 2 de noviembre de 2001.
Texto ordenado con modificaciones de la Ley 27.580 (2023), vigente desde el 1 de diciembre de 2023.
Jurisdicción: República Argentina.
Estado: VIGENTE.

Página 1

Artículo 1º — Objeto.
La presente ley tiene por objeto la protección integral de los datos personales asentados en archivos, registros, bancos u otros medios técnicos de tratamiento, sean estos públicos o privados destinados a dar informes, para garantizar el derecho al honor y a la intimidad de las personas, así como también el acceso a la información que sobre las mismas se registre.

Artículo 2º — Ámbito de aplicación.
La presente ley se aplica al tratamiento de datos personales efectuado en territorio argentino. Se aplica también a quienes ofrezcan bienes o servicios a personas en Argentina, con independencia del lugar de tratamiento.

Artículo 3º — Definiciones.
A los efectos de la presente ley, se entiende por:
a) Datos personales: información de cualquier tipo referida a personas físicas o jurídicas determinadas o determinables.
b) Datos sensibles: datos personales que revelan origen racial y étnico, opinión política, convicciones religiosas o filosóficas, afiliación sindical, información relativa a la salud o a la vida sexual.
c) Tratamiento: cualquier operación o procedimiento sistemático que permita la recolección, conservación, ordenación, almacenamiento, modificación, evaluación, bloqueo, cesión, comunicación, difusión o uso de datos.

Artículo 4º — Principios.
El tratamiento de datos personales se basa en los siguientes principios:
a) Principio de licitud: el tratamiento requiere consentimiento libre, expreso e informado del titular.
b) Principio de finalidad: los datos deben recolectarse para fines determinados y legítimos.
c) Principio de proporcionalidad: los datos recolectados deben ser adecuados y no excesivos.
d) Principio de calidad: los datos deben ser exactos y actualizados.
e) Principio de seguridad: el responsable debe adoptar medidas técnicas y organizativas para garantizar la seguridad.

Página 2

Artículo 5º — Consentimiento.
El consentimiento del titular de los datos debe ser previo, libre, expreso e informado. El titular tiene derecho a revocarlo en cualquier momento. El consentimiento no es necesario cuando los datos se recolectan para fines de gestión de la relación contractual con el titular o cuando se trate de datos de acceso público.

Artículo 6º — Derechos del titular.
El titular de los datos tiene derecho a:
a) Solicitar y acceder a la información de sus datos tratados.
b) Solicitar la rectificación, actualización o supresión de los datos.
c) Oponerse al tratamiento de sus datos por motivos legítimos.
d) Retirar el consentimiento en cualquier momento, sin que ello afecte la licitud del tratamiento anterior.

Artículo 7º — Datos sensibles.
El tratamiento de datos sensibles está prohibido salvo consentimiento expreso del titular, o cuando medie interés público. La información relacionada con la salud solo puede ser tratada por profesionales de la salud bajo secreto profesional.

Artículo 8º — Responsable del tratamiento.
El responsable del tratamiento de datos es la persona física o jurídica que decide sobre el tratamiento. Debe registrar el banco de datos ante la Autoridad de Aplicación (Agencia de Acceso a la Información Pública).

Artículo 9º — Sanciones.
El incumplimiento de la presente ley es sancionado con multas de $1.000 a $500.000 (textos anteriores); las actualizaciones por la Ley 27.580 (2023) elevan el máximo a $100.000.000 ARS. Sin perjuicio de las acciones civiles y penales que correspondan.

DEMO — DOCUMENTO FICTICIO DE PRUEBA, NO REPRESENTA DATOS REALES.`,
  },
];

// Preguntas de evaluación con respuesta esperada (dataset RAGAS-like)
export const SAMPLE_EVALUATION_QUESTIONS = [
  {
    question: '¿Cuál es el activo total de DemoCorp al 31 de diciembre de 2023?',
    expected: '$118.500 miles de pesos argentinos (ARS).',
    expectedDocType: 'BALANCE',
    tags: 'balances',
  },
  {
    question: '¿Cuál fue el resultado neto del ejercicio 2023 de DemoCorp?',
    expected: 'Resultado neto de $17.500 miles ARS (positivo).',
    expectedDocType: 'BALANCE',
    tags: 'balances',
  },
  {
    question: '¿Cuál es el patrimonio neto de DemoCorp al cierre 2023?',
    expected: 'Patrimonio neto de $74.500 miles ARS.',
    expectedDocType: 'BALANCE',
    tags: 'balances',
  },
  {
    question: '¿Cuál es el plazo de vigencia del contrato DemoCorp-AlphaTech?',
    expected: '24 meses, desde el 15 de enero de 2024 hasta el 15 de enero de 2026.',
    expectedDocType: 'CONTRACT',
    tags: 'contratos',
  },
  {
    question: '¿Cuál es el precio mensual del contrato entre DemoCorp y AlphaTech?',
    expected: '$500.000 ARS mensuales más IVA, con actualización trimestral por IPC.',
    expectedDocType: 'CONTRACT',
    tags: 'contratos',
  },
  {
    question: '¿Qué SLA garantiza AlphaTech en el contrato?',
    expected: '99,5% mensual de disponibilidad del servicio.',
    expectedDocType: 'CONTRACT',
    tags: 'contratos',
  },
  {
    question: '¿Qué penalidad aplica por incumplimiento del SLA en el contrato DemoCorp-AlphaTech?',
    expected: '5% del precio mensual por cada 0,5% de incumplimiento, hasta máximo 25% mensual.',
    expectedDocType: 'CONTRACT',
    tags: 'contratos',
  },
  {
    question: '¿Cuál es la jurisdicción aplicable al contrato DemoCorp-AlphaTech?',
    expected: 'República Argentina, Tribunales Nacionales en lo Comercial de CABA.',
    expectedDocType: 'CONTRACT',
    tags: 'contratos',
  },
  {
    question: '¿Qué principios rigen el tratamiento de datos personales según la Ley 25.326?',
    expected: 'Licitud, finalidad, proporcionalidad, calidad y seguridad.',
    expectedDocType: 'REGULATION',
    tags: 'normativas',
  },
  {
    question: '¿Cuándo se requiere consentimiento para el tratamiento de datos sensibles?',
    expected: 'Siempre, salvo cuando medie interés público; el consentimiento debe ser expreso.',
    expectedDocType: 'REGULATION',
    tags: 'normativas',
  },
  {
    question: '¿Qué derechos tiene el titular de los datos personales?',
    expected: 'Acceso, rectificación, supresión, oposición y revocación del consentimiento.',
    expectedDocType: 'REGULATION',
    tags: 'normativas',
  },
  {
    question: '¿A partir de cuándo está vigente el texto ordenado 2023 de la Ley 25.326?',
    expected: '1 de diciembre de 2023.',
    expectedDocType: 'REGULATION',
    tags: 'normativas',
  },
  // Pregunta fuera del corpus: debe responder "no se encontró información suficiente"
  {
    question: '¿Cuál es la cotización del dólar en Argentina al 31 de diciembre de 2023?',
    expected: 'No se encontró información suficiente en los documentos proporcionados.',
    expectedDocType: undefined,
    tags: 'out-of-corpus',
  },
];
