PRAGMA foreign_keys = ON;
BEGIN;

-- Preview: how many rows will change?
SELECT COUNT(*) AS to_change
FROM raceresults
WHERE TRIM(driver) COLLATE NOCASE = TRIM('Brainycactus30');

-- Do it:
UPDATE raceresults
SET driver = 'brainyCactus30'
WHERE TRIM(driver) COLLATE NOCASE = TRIM('Brainycactus30');

-- How many rows actually changed?
SELECT changes() AS rows_changed;

COMMIT;
