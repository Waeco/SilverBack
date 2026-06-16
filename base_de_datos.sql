-- ============================================================
-- SILVERBACK — SCRIPT DE CONFIGURACIÓN DE BASE DE DATOS
-- ============================================================
CREATE DATABASE IF NOT EXISTS silverback_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE silverback_db;

-- ============================================================
-- TABLA: usuarios
-- ============================================================
CREATE TABLE IF NOT EXISTS usuarios (
  id_usuario       INT AUTO_INCREMENT PRIMARY KEY,
  nombre_completo  VARCHAR(150)  NOT NULL,
  correo           VARCHAR(200)  NOT NULL UNIQUE,
  contrasena_hash  VARCHAR(255)  NOT NULL,
  rol              ENUM('atleta', 'nutriologo', 'admin') NOT NULL DEFAULT 'atleta',
  fecha_registro   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  activo           TINYINT(1)    NOT NULL DEFAULT 1,
  INDEX idx_correo (correo),
  INDEX idx_rol (rol)
) ENGINE=InnoDB;

-- ============================================================
-- TABLA: pacientes_perfil
-- ============================================================
CREATE TABLE IF NOT EXISTS pacientes_perfil (
  id_paciente         INT AUTO_INCREMENT PRIMARY KEY,
  id_usuario          INT NOT NULL,
  peso_actual         DECIMAL(5,1)  DEFAULT NULL,
  altura              DECIMAL(5,1)  DEFAULT NULL,
  deporte             VARCHAR(100)  DEFAULT NULL,
  objetivo            VARCHAR(200)  DEFAULT NULL,
  id_nutriologo_asignado INT DEFAULT NULL,
  FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
  FOREIGN KEY (id_nutriologo_asignado) REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
  INDEX idx_paciente_usuario (id_usuario)
) ENGINE=InnoDB;

-- ============================================================
-- TABLA: nutriologos_perfil
-- ============================================================
CREATE TABLE IF NOT EXISTS nutriologos_perfil (
  id_nutriologo INT AUTO_INCREMENT PRIMARY KEY,
  id_usuario    INT NOT NULL,
  cedula        VARCHAR(50)  NOT NULL,
  especialidad  VARCHAR(100) DEFAULT NULL,
  experiencia   INT DEFAULT NULL,
  biografia     TEXT DEFAULT NULL,
  verificado    TINYINT(1)   NOT NULL DEFAULT 0,
  FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
  UNIQUE INDEX idx_cedula (cedula),
  INDEX idx_nutriologo_usuario (id_usuario)
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
  FOREIGN KEY (id_paciente) REFERENCES pacientes_perfil(id_paciente) ON DELETE CASCADE,
  INDEX idx_comida_fecha (fecha),
  INDEX idx_comida_paciente_fecha (id_paciente, fecha),
  INDEX idx_comida_tipo (tipo_comida)
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
  estado        ENUM('pendiente', 'confirmada', 'completada', 'cancelada') NOT NULL DEFAULT 'pendiente',
  notas         TEXT DEFAULT NULL,
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
  FOREIGN KEY (id_paciente) REFERENCES pacientes_perfil(id_paciente) ON DELETE CASCADE,
  UNIQUE INDEX idx_habito_fecha (id_paciente, fecha)
) ENGINE=InnoDB;

-- ============================================================
-- DATOS DE PRUEBA (SEED)
-- ============================================================
INSERT INTO usuarios (nombre_completo, correo, contrasena_hash, rol) VALUES
  ('Juan Pérez',     'juan@ejemplo.com',    SHA2('test1234', 256), 'atleta'),
  ('Dra. María García', 'maria@ejemplo.com', SHA2('test1234', 256), 'nutriologo'),
  ('Admin Sistema',  'admin@silverback.com', SHA2('admin1234', 256), 'admin');

INSERT INTO pacientes_perfil (id_usuario, peso_actual, altura, deporte, objetivo, id_nutriologo_asignado) VALUES
  (1, 72.5, 175, 'CrossFit', 'Aumento de masa muscular', 2);

INSERT INTO nutriologos_perfil (id_usuario, cedula, especialidad, experiencia, biografia, verificado) VALUES
  (2, '12345678', 'Nutrición Deportiva', 10, 'Especialista en rendimiento deportivo con más de 10 años de experiencia.', 1);

INSERT INTO comidas_diarias (id_paciente, fecha, tipo_comida, nombre_alimento, cantidad, unidad, calorias_totales, proteinas_totales, grasas_totales, carbohidratos_totales) VALUES
  (1, CURDATE(), 'desayuno', 'Avena Integral', 100, 'g', 389, 16.9, 6.9, 66.3),
  (1, CURDATE(), 'desayuno', 'Huevos Revueltos', 150, 'g', 223.5, 14.94, 16.47, 1.05),
  (1, CURDATE(), 'comida', 'Pechuga de Pollo', 200, 'g', 330, 62, 7.2, 0),
  (1, CURDATE(), 'comida', 'Arroz Integral', 150, 'g', 166.5, 3.87, 1.35, 34.44);

INSERT INTO citas (id_paciente, id_nutriologo, fecha, hora, estado) VALUES
  (1, 1, DATE_ADD(CURDATE(), INTERVAL 3 DAY), '10:00:00', 'confirmada');
