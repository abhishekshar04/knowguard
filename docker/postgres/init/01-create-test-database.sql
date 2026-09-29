-- Runs once, on first container start (empty data volume).
-- Separate database for integration/e2e tests so they never touch development data.
CREATE DATABASE knowguard_test;
