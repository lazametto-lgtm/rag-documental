-- Init script para PostgreSQL (se ejecuta automáticamente al crear el contenedor)
CREATE DATABASE IF NOT EXISTS ragdb;
-- El usuario y la DB se crean con las variables de entorno POSTGRES_DB y POSTGRES_USER
-- Este script solo asegura permisos extra
GRANT ALL PRIVILEGES ON DATABASE ragdb TO raguser;
