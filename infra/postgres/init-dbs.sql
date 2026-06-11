-- This script runs as the postgres superuser on first startup.
-- The 'devboard' database is already created by POSTGRES_DB env var.
-- We just need to create the extra databases for Keycloak and OpenFGA.

CREATE DATABASE keycloak;
CREATE DATABASE openfga;
-- Dedicated database for the integration test suite, so tests never touch dev data.
CREATE DATABASE devboard_test;

-- Grant all privileges to our single user
GRANT ALL PRIVILEGES ON DATABASE keycloak TO devboard;
GRANT ALL PRIVILEGES ON DATABASE openfga TO devboard;
GRANT ALL PRIVILEGES ON DATABASE devboard_test TO devboard;
