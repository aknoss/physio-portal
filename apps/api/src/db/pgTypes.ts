import { types } from 'pg';

const DATE_OID = 1082;

types.setTypeParser(DATE_OID, (value) => value);
