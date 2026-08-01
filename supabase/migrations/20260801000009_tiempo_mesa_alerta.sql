-- Temporizador de mesa en vivo (F9-03): a partir de cuántos minutos desde que
-- se abrió el pedido se colorea el temporizador en ámbar/rojo. Independiente
-- de alerta_mesa_sin_atender_minutos (esa es sobre falta de captura; esta es
-- solo el tiempo transcurrido en sí).
ALTER TABLE config_sistema
  ADD COLUMN IF NOT EXISTS tiempo_mesa_alerta_minutos INTEGER NOT NULL DEFAULT 60;
