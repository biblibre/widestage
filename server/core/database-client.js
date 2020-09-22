const { MysqlAdapter } = require('../database-adapters/mysql.js');
const { PgAdapter } = require('../database-adapters/pg.js');
const { MssqlAdapter } = require('../database-adapters/mssql.js');
const { OracleAdapter } = require('../database-adapters/oracle.js');

class DatabaseClient {
    constructor (adapter) {
        this.adapter = adapter;
    }

    static fromDatasource (datasource) {
        const params = {
            host: datasource.connection.host,
            port: datasource.connection.port,
            database: datasource.connection.database,
            user: datasource.connection.userName,
            password: datasource.connection.password,
        };

        let adapter;
        switch (datasource.type) {
        case 'MySQL':
            adapter = new MysqlAdapter(params);
            break;

        case 'POSTGRE':
            params.search_path = datasource.connection.search_path;
            adapter = new PgAdapter(params);
            break;

        case 'MSSQL':
            adapter = new MssqlAdapter(params);
            break;

        case 'ORACLE':
            adapter = new OracleAdapter(params);
            break;
        }

        return new DatabaseClient(adapter);
    }

    testConnection () {
        return this.adapter.testConnection();
    }

    getCollectionNames () {
        return this.adapter.getCollectionNames();
    }

    getCollectionSchema (collectionName) {
        return this.adapter.getCollectionSchema(collectionName);
    }

    getSqlQuerySchema (sqlQuery) {
        return this.adapter.getSqlQuerySchema(sqlQuery);
    }

    getQueryResults (query) {
        return this.adapter.getQueryResults(query);
    }
}

module.exports = DatabaseClient;
