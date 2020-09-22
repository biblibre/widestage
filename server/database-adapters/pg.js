const pg = require('pg');
const debug = require('debug')('urungi:sql');
const { BaseAdapter } = require('./base.js');
const SqlQueryBuilder = require('../core/sqlQueryBuilder.js');

class PgAdapter extends BaseAdapter {
    getClient () {
        // Return COUNT() result as Number instead of String
        pg.defaults.parseInt8 = true;

        const client = new pg.Client({
            user: this.params.user,
            host: this.params.host,
            database: this.params.database,
            password: this.params.password,
            port: this.params.port,
        });

        return client;
    }

    async testConnection () {
        const client = this.getClient();

        await client.connect();

        return client.end();
    }

    async getCollectionNames () {
        const schemas = this.getSchemas();
        const sql = 'SELECT table_name FROM information_schema.tables ' +
            'WHERE table_catalog = $1 AND table_schema = ANY($2) ORDER BY table_schema, table_name';
        const res = await this.query(sql, [this.params.database, schemas]);

        return res.rows.map(row => row.table_name);
    }

    async getCollectionSchema (collectionName) {
        const schemas = this.getSchemas();
        for (const schema of schemas) {
            const sql =
                'SELECT column_name, data_type ' +
                'FROM information_schema.columns ' +
                'WHERE table_catalog = $1 AND table_name = $2 AND table_schema = $3';

            const res = await this.query(sql, [this.params.database, collectionName, schema]);
            if (res.rows.length === 0) {
                continue;
            }

            const date_types = ['date', 'timestamp', 'timestamp with time zone'];
            const number_types = ['bigint', 'bigserial', 'double precision', 'integer', 'money', 'numeric', 'real', 'smallint', 'smallserial', 'serial'];

            const columns = res.rows.map(row => {
                let type = 'string';
                if (date_types.includes(row.data_type)) {
                    type = 'date';
                } else if (number_types.includes(row.data_type)) {
                    type = 'number';
                } else if (row.data_type === 'boolean') {
                    type = 'boolean';
                }

                return {
                    name: row.column_name,
                    type: type,
                };
            });

            return { columns };
        }
    }

    async getSqlQuerySchema (sql) {
        const res = await this.query(`WITH sub AS (${sql}) SELECT * FROM sub LIMIT 1`);

        const columns = Object.entries(res.rows[0]).map(function ([name, value]) {
            let type = 'string';

            if (typeof value === 'number' && !isNaN(value)) {
                type = 'number';
            } else if (typeof value === 'boolean') {
                type = 'boolean';
            } else if (value instanceof Date) {
                type = 'date';
            }

            return { name, type };
        });

        return { columns };
    }

    async getQueryResults (query) {
        const knex = require('knex')({
            client: 'pg',
        });
        const sqlQueryBuilder = new SqlQueryBuilder(knex);
        const q = sqlQueryBuilder.build(query);
        const { sql, bindings } = q.toSQL().toNative();

        const start = Date.now();
        const res = await this.query(sql, bindings);
        const end = Date.now();

        return {
            data: res.rows,
            sql: sql,
            bindings: bindings,
            time: end - start,
        };
    }

    async query (sql, params = []) {
        const client = this.getClient();
        await client.connect();

        if (this.params.search_path) {
            await client.query(`SET search_path TO ${this.params.search_path}`);
        }

        debug('Running query: %o', { sql: sql, params: params });
        try {
            const res = await client.query(sql, params);
            return res;
        } finally {
            await client.end();
        }
    }

    getSchemas () {
        const search_path = this.params.search_path || 'public';
        const schemas = search_path.split(',').map(s => s.trim());

        return schemas;
    }
}

module.exports = { PgAdapter };
