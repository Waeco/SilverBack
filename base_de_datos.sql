-- ============================================================
-- SILVERBACK — SCRIPT DE CONFIGURACIÓN DE BASE DE DATOS
-- Versión mejorada: normalización, CHECKs, updated_at, FKs corregidas
-- ============================================================
CREATE DATABASE IF NOT EXISTS silverback_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE silverback_db;

-- Eliminar tablas existentes para recrearlas con los cambios de nombres
DROP TABLE IF EXISTS detalles_rutina;
DROP TABLE IF EXISTS planes_rutina;
DROP TABLE IF EXISTS detalles_dieta;
DROP TABLE IF EXISTS planes_dieta;
DROP TABLE IF EXISTS comidas_diarias;
DROP TABLE IF EXISTS citas;
DROP TABLE IF EXISTS solicitudes_nutriologo;
DROP TABLE IF EXISTS historial_medico;
DROP TABLE IF EXISTS registro_habitos;
DROP TABLE IF EXISTS pacientes_perfil;
DROP TABLE IF EXISTS nutriologos_perfil;
DROP TABLE IF EXISTS usuarios;
DROP TABLE IF EXISTS cache_alimentos;

-- ============================================================
-- TABLA: usuarios
-- ============================================================
CREATE TABLE IF NOT EXISTS usuarios (
  id_usuario       INT AUTO_INCREMENT PRIMARY KEY,
  nombre_completo  VARCHAR(150)  NOT NULL,
  correo           VARCHAR(200)  NOT NULL UNIQUE,
  contrasenia_hash  VARCHAR(255)  NOT NULL,
  rol              ENUM('atleta', 'nutriologo', 'admin') NOT NULL DEFAULT 'atleta',
  fecha_registro   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  activo           TINYINT(1)    NOT NULL DEFAULT 1,
  INDEX idx_correo (correo),
  INDEX idx_rol (rol)
) ENGINE=InnoDB;

-- ============================================================
-- TABLA: nutriologos_perfil
-- Debe crearse ANTES que pacientes_perfil por la FK corregida
-- ============================================================
CREATE TABLE IF NOT EXISTS nutriologos_perfil (
  id_nutriologo INT AUTO_INCREMENT PRIMARY KEY,
  id_usuario    INT NOT NULL,
  cedula        VARCHAR(50)  NOT NULL,
  especialidad  VARCHAR(100) DEFAULT NULL,
  experiencia   INT          DEFAULT NULL,
  biografia     TEXT         DEFAULT NULL,
  verificado    TINYINT(1)   NOT NULL DEFAULT 0,
  actualizado_en DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
  UNIQUE INDEX idx_cedula (cedula),
  INDEX idx_nutriologo_usuario (id_usuario)
) ENGINE=InnoDB;

-- ============================================================
-- TABLA: pacientes_perfil
-- FK id_nutriologo_asignado corregida → nutriologos_perfil
-- ============================================================
CREATE TABLE IF NOT EXISTS pacientes_perfil (
  id_paciente         INT AUTO_INCREMENT PRIMARY KEY,
  id_usuario          INT NOT NULL,
  peso_actual         DECIMAL(5,1)  DEFAULT NULL,
  altura              DECIMAL(5,1)  DEFAULT NULL,
  deporte             VARCHAR(100)  DEFAULT NULL,
  objetivo            VARCHAR(200)  DEFAULT NULL,
  id_nutriologo_asignado INT DEFAULT NULL,
  actualizado_en      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
  FOREIGN KEY (id_nutriologo_asignado) REFERENCES nutriologos_perfil(id_nutriologo) ON DELETE SET NULL,
  INDEX idx_paciente_usuario (id_usuario),
  INDEX idx_nutriologo_asignado (id_nutriologo_asignado)
) ENGINE=InnoDB;

-- ============================================================
-- TABLA: comidas_diarias
-- ============================================================
CREATE TABLE IF NOT EXISTS comidas_diarias (
  id_comida             INT AUTO_INCREMENT PRIMARY KEY,
  id_paciente           INT NOT NULL,
  fecha                 DATE NOT NULL,
  tipo_comida           ENUM('desayuno', 'colacion_1', 'comida', 'colacion_2', 'cena') NOT NULL,
  nombre_alimento       VARCHAR(200) NOT NULL,
  cantidad              DECIMAL(8,2) NOT NULL DEFAULT 100,
  unidad                VARCHAR(20)  NOT NULL DEFAULT 'g',
  calorias_totales      DECIMAL(8,2) NOT NULL DEFAULT 0,
  proteinas_totales     DECIMAL(8,2) NOT NULL DEFAULT 0,
  grasas_totales        DECIMAL(8,2) NOT NULL DEFAULT 0,
  carbohidratos_totales DECIMAL(8,2) NOT NULL DEFAULT 0,
  actualizado_en        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (id_paciente) REFERENCES pacientes_perfil(id_paciente) ON DELETE CASCADE,
  INDEX idx_comida_fecha (fecha),
  INDEX idx_comida_paciente_fecha (id_paciente, fecha),
  INDEX idx_comida_tipo (tipo_comida),
  CONSTRAINT chk_comida_cantidad CHECK (cantidad > 0)
) ENGINE=InnoDB;

-- ============================================================
-- TABLA: citas
-- ============================================================
CREATE TABLE IF NOT EXISTS citas (
  id_cita       INT AUTO_INCREMENT PRIMARY KEY,
  id_paciente   INT NOT NULL,
  id_nutriologo INT NOT NULL,
  fecha         DATE NOT NULL,
  hora          TIME NOT NULL,
  tipo          ENUM('videollamada', 'presencial') NOT NULL DEFAULT 'presencial',
  estado        ENUM('pendiente', 'confirmada', 'completada', 'cancelada') NOT NULL DEFAULT 'pendiente',
  notas         TEXT DEFAULT NULL,
  actualizado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (id_paciente) REFERENCES pacientes_perfil(id_paciente) ON DELETE CASCADE,
  FOREIGN KEY (id_nutriologo) REFERENCES nutriologos_perfil(id_nutriologo) ON DELETE CASCADE,
  INDEX idx_cita_fecha (fecha),
  INDEX idx_cita_paciente (id_paciente),
  INDEX idx_cita_nutriologo (id_nutriologo)
) ENGINE=InnoDB;

-- ============================================================
-- TABLA: registro_habitos
-- ============================================================
CREATE TABLE IF NOT EXISTS registro_habitos (
  id_registro         INT AUTO_INCREMENT PRIMARY KEY,
  id_paciente         INT NOT NULL,
  fecha               DATE NOT NULL,
  peso                DECIMAL(5,1) DEFAULT NULL,
  agua_litros         DECIMAL(4,2) DEFAULT NULL,
  calorias_consumidas INT DEFAULT NULL,
  actualizado_en      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (id_paciente) REFERENCES pacientes_perfil(id_paciente) ON DELETE CASCADE,
  UNIQUE INDEX idx_habito_fecha (id_paciente, fecha),
  CONSTRAINT chk_agua CHECK (agua_litros IS NULL OR agua_litros >= 0),
  CONSTRAINT chk_calorias CHECK (calorias_consumidas IS NULL OR calorias_consumidas >= 0)
) ENGINE=InnoDB;

-- ============================================================
-- TABLA: planes_dieta
-- ============================================================
CREATE TABLE IF NOT EXISTS planes_dieta (
  id_plan_dieta         INT AUTO_INCREMENT PRIMARY KEY,
  id_paciente           INT NOT NULL,
  id_nutriologo         INT NOT NULL,
  activo                TINYINT(1)   NOT NULL DEFAULT 1,
  fecha_asignado        DATE         NOT NULL DEFAULT (CURRENT_DATE),
  actualizado_en        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (id_paciente) REFERENCES pacientes_perfil(id_paciente) ON DELETE CASCADE,
  FOREIGN KEY (id_nutriologo) REFERENCES nutriologos_perfil(id_nutriologo) ON DELETE CASCADE,
  INDEX idx_plan_dieta_paciente (id_paciente, activo)
) ENGINE=InnoDB;

-- ============================================================
-- TABLA: detalles_dieta
-- ============================================================
CREATE TABLE IF NOT EXISTS detalles_dieta (
  id_detalle_dieta       INT AUTO_INCREMENT PRIMARY KEY,
  id_plan_dieta          INT NOT NULL,
  tipo_comida           ENUM('desayuno', 'colacion_1', 'comida', 'colacion_2', 'cena') NOT NULL,
  nombre_alimento       VARCHAR(200) NOT NULL,
  cantidad              DECIMAL(8,2) NOT NULL DEFAULT 100,
  unidad                VARCHAR(20)  NOT NULL DEFAULT 'g',
  calorias_totales      DECIMAL(8,2) NOT NULL DEFAULT 0,
  proteinas_totales     DECIMAL(8,2) NOT NULL DEFAULT 0,
  grasas_totales        DECIMAL(8,2) NOT NULL DEFAULT 0,
  carbohidratos_totales DECIMAL(8,2) NOT NULL DEFAULT 0,
  FOREIGN KEY (id_plan_dieta) REFERENCES planes_dieta(id_plan_dieta) ON DELETE CASCADE,
  INDEX idx_detalle_dieta_plan (id_plan_dieta),
  CONSTRAINT chk_detalle_cantidad CHECK (cantidad > 0)
) ENGINE=InnoDB;

-- ============================================================
-- TABLA: planes_rutina
-- ============================================================
CREATE TABLE IF NOT EXISTS planes_rutina (
  id_plan_rutina      INT AUTO_INCREMENT PRIMARY KEY,
  id_paciente         INT NOT NULL,
  id_nutriologo       INT DEFAULT NULL,
  nombre_rutina       VARCHAR(100) DEFAULT NULL,
  activo              TINYINT(1)   NOT NULL DEFAULT 1,
  fecha_asignado      DATE         NOT NULL DEFAULT (CURRENT_DATE),
  actualizado_en      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (id_paciente) REFERENCES pacientes_perfil(id_paciente) ON DELETE CASCADE,
  FOREIGN KEY (id_nutriologo) REFERENCES nutriologos_perfil(id_nutriologo) ON DELETE SET NULL,
  INDEX idx_rutina_paciente (id_paciente, activo)
) ENGINE=InnoDB;

-- ============================================================
-- TABLA: detalles_rutina
-- id_ejercicio: ID numérico de wger.de (puede ser NULL si es ejercicio personalizado)
-- ============================================================
CREATE TABLE IF NOT EXISTS detalles_rutina (
  id_detalle_rutina    INT AUTO_INCREMENT PRIMARY KEY,
  id_plan_rutina       INT NOT NULL,
  id_ejercicio        INT          DEFAULT NULL,
  nombre_ejercicio    VARCHAR(200) NOT NULL,
  descripcion         TEXT         DEFAULT NULL,
  series              INT          NOT NULL DEFAULT 3,
  repeticiones        VARCHAR(50)  NOT NULL DEFAULT '10',
  descanso            VARCHAR(50)  DEFAULT '60 seg',
  imagen_url          VARCHAR(500) DEFAULT NULL,
  video_url           VARCHAR(500) DEFAULT NULL,
  orden               INT          NOT NULL DEFAULT 0,
  FOREIGN KEY (id_plan_rutina) REFERENCES planes_rutina(id_plan_rutina) ON DELETE CASCADE,
  INDEX idx_detalle_rutina_plan (id_plan_rutina),
  CONSTRAINT chk_series CHECK (series > 0),
  CONSTRAINT chk_orden CHECK (orden >= 0)
) ENGINE=InnoDB;

-- ============================================================
-- TABLA: cache_alimentos
-- Cache local de búsquedas de FatSecret
-- ============================================================
CREATE TABLE IF NOT EXISTS cache_alimentos (
  id_cache        INT AUTO_INCREMENT PRIMARY KEY,
  id_externo      VARCHAR(50)   NOT NULL,
  nombre          VARCHAR(200)  NOT NULL,
  descripcion     TEXT          DEFAULT NULL,
  calorias_100g   DECIMAL(8,2)  DEFAULT 0,
  proteinas_100g  DECIMAL(8,2)  DEFAULT 0,
  grasas_100g     DECIMAL(8,2)  DEFAULT 0,
  carbohidratos_100g  DECIMAL(8,2)  DEFAULT 0,
  consultado_en   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_cache_alimento_nombre (nombre)
) ENGINE=InnoDB;

-- ============================================================
-- TABLA: historial_medico
-- ============================================================
CREATE TABLE IF NOT EXISTS historial_medico (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  id_paciente     INT NOT NULL,
  id_nutriologo   INT DEFAULT NULL,
  tipo            ENUM('peso', 'altura', 'enfermedad', 'alergia', 'nota') NOT NULL,
  valor           VARCHAR(255) DEFAULT NULL,
  descripcion     TEXT DEFAULT NULL,
  fecha           DATE NOT NULL DEFAULT (CURRENT_DATE),
  creado_en       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (id_paciente) REFERENCES pacientes_perfil(id_paciente) ON DELETE CASCADE,
  FOREIGN KEY (id_nutriologo) REFERENCES nutriologos_perfil(id_nutriologo) ON DELETE SET NULL,
  INDEX idx_historial_paciente (id_paciente),
  INDEX idx_historial_tipo (tipo),
  INDEX idx_historial_fecha (id_paciente, fecha)
) ENGINE=InnoDB;

-- ============================================================
-- TABLA: solicitudes_nutriologo
-- Solicitudes de pacientes para ser asignados a un nutriólogo
-- ============================================================
CREATE TABLE IF NOT EXISTS solicitudes_nutriologo (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  id_paciente    INT NOT NULL,
  id_nutriologo  INT NOT NULL,
  estado         ENUM('pendiente', 'aceptada', 'rechazada') NOT NULL DEFAULT 'pendiente',
  creado_en      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (id_paciente) REFERENCES pacientes_perfil(id_paciente) ON DELETE CASCADE,
  FOREIGN KEY (id_nutriologo) REFERENCES nutriologos_perfil(id_nutriologo) ON DELETE CASCADE,
  UNIQUE INDEX idx_solicitud_unica (id_paciente, id_nutriologo, estado),
  INDEX idx_solicitud_nutriologo (id_nutriologo, estado)
) ENGINE=InnoDB;

-- ============================================================
-- TABLA: ejercicios
-- Catálogo local de ejercicios sincronizado desde wger.de (español)
-- ============================================================
CREATE TABLE IF NOT EXISTS ejercicios (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  wger_id        INT          UNIQUE,
  nombre         VARCHAR(255) NOT NULL,
  descripcion    TEXT,
  imagen_url     VARCHAR(500) DEFAULT NULL,
  video_url      VARCHAR(500) DEFAULT NULL,
  creado_en      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ejercicio_nombre (nombre),
  INDEX idx_wger_id (wger_id)
) ENGINE=InnoDB;

-- ============================================================
-- DATOS DE PRUEBA (SEED)
-- ============================================================
INSERT INTO usuarios (nombre_completo, correo, contrasenia_hash, rol) VALUES
  ('Juan Pérez',     'juan@ejemplo.com',    SHA2('test1234', 256), 'atleta'),
  ('Dra. María García', 'maria@ejemplo.com', SHA2('test1234', 256), 'nutriologo'),
  ('Admin Sistema',  'admin@silverback.com', SHA2('admin1234', 256), 'admin');

INSERT INTO nutriologos_perfil (id_usuario, cedula, especialidad, experiencia, biografia, verificado) VALUES
  (2, '12345678', 'Nutrición Deportiva', 10, 'Especialista en rendimiento deportivo con más de 10 años de experiencia.', 1);

INSERT INTO pacientes_perfil (id_usuario, peso_actual, altura, deporte, objetivo, id_nutriologo_asignado) VALUES
  (1, 72.5, 175, 'CrossFit', 'Aumento de masa muscular', 1);

INSERT INTO comidas_diarias (id_paciente, fecha, tipo_comida, nombre_alimento, cantidad, unidad, calorias_totales, proteinas_totales, grasas_totales, carbohidratos_totales) VALUES
  (1, CURDATE(), 'desayuno', 'Avena Integral', 100, 'g', 389, 16.9, 6.9, 66.3),
  (1, CURDATE(), 'desayuno', 'Huevos Revueltos', 150, 'g', 223.5, 14.94, 16.47, 1.05),
  (1, CURDATE(), 'comida', 'Pechuga de Pollo', 200, 'g', 330, 62, 7.2, 0),
  (1, CURDATE(), 'comida', 'Arroz Integral', 150, 'g', 166.5, 3.87, 1.35, 34.44);

INSERT INTO citas (id_paciente, id_nutriologo, fecha, hora, tipo, estado) VALUES
  (1, 1, DATE_ADD(CURDATE(), INTERVAL 3 DAY), '10:00:00', 'videollamada', 'confirmada');

INSERT INTO planes_rutina (id_paciente, id_nutriologo, activo) VALUES
  (1, 1, 1);

INSERT INTO detalles_rutina (id_plan_rutina, nombre_ejercicio, descripcion, series, repeticiones, descanso, orden) VALUES
  (1, 'Sentadillas', 'Ejercicio básico para piernas y glúteos. Mantén la espalda recta.', 3, '12', '60 seg', 0),
  (1, 'Flexiones de Brazos', 'Ejercicio clásico para pecho, hombros y tríceps.', 3, '10', '45 seg', 1),
  (1, 'Plancha', 'Ejercicio isométrico para core. Mantén el cuerpo alineado.', 3, '30 seg', '30 seg', 2);
