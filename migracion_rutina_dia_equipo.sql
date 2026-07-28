-- ============================================================
-- MIGRACIÓN: agrega día de la semana, equipo y progresión de peso
-- a la tabla detalles_rutina (para bases de datos ya existentes).
-- Ejecutar una sola vez contra la base de datos "silverback".
-- ============================================================

ALTER TABLE detalles_rutina
  ADD COLUMN IF NOT EXISTS dia_semana VARCHAR(20) DEFAULT 'Todos los días' AFTER orden,
  ADD COLUMN IF NOT EXISTS equipo VARCHAR(50) DEFAULT NULL AFTER dia_semana,
  ADD COLUMN IF NOT EXISTS progresion_peso VARCHAR(255) DEFAULT NULL AFTER equipo;

-- Rellena registros existentes que hayan quedado con NULL en dia_semana
UPDATE detalles_rutina SET dia_semana = 'Todos los días' WHERE dia_semana IS NULL;
