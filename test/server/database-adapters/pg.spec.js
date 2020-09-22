const { PgAdapter } = require('../../../server/database-adapters/pg.js');

describe('PostgreSQL database adapter', function () {
    describe('when connection is not ok', function () {
        const adapter = new PgAdapter({ host: 'invalid-host' });

        describe('testConnection', function () {
            it('should throw', function () {
                return expect(adapter.testConnection()).rejects.toThrow();
            });
        });

        describe('getCollectionNames', function () {
            it('should throw', function () {
                return expect(adapter.getCollectionNames()).rejects.toThrow();
            });
        });

        describe('getCollectionSchema', function () {
            it('should throw', function () {
                return expect(adapter.getCollectionSchema('foo')).rejects.toThrow();
            });
        });

        describe('getSqlQuerySchema', function () {
            it('should throw', function () {
                return expect(adapter.getSqlQuerySchema('SELECT * FROM foo')).rejects.toThrow();
            });
        });
    });

    if (process.env.URUNGI_TEST_PG) {
        describe('when connection is ok', function () {
            const params = JSON.parse(process.env.URUNGI_TEST_PG);
            const adapter = new PgAdapter(params);
            const tableData = require('./__data__/table-data.js');

            beforeAll(async function () {
                // DROP all tables
                await adapter.query("DO $$ DECLARE r RECORD; BEGIN FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = current_schema()) LOOP EXECUTE 'DROP TABLE ' || quote_ident(r.tablename) || ' CASCADE'; END LOOP; END $$;");

                await adapter.query('CREATE TABLE artist (artist_id SERIAL, name TEXT)');
                await adapter.query('CREATE TABLE album (album_id SERIAL, artist_id INTEGER, title TEXT, release_date DATE, price NUMERIC(10, 2))');
                await adapter.query('CREATE TABLE song (song_id SERIAL, album_id INTEGER, title TEXT)');

                for (const artist of tableData.artist) {
                    await adapter.query('INSERT INTO artist (artist_id, name) VALUES ($1, $2)', artist);
                }
                for (const album of tableData.album) {
                    await adapter.query('INSERT INTO album (album_id, artist_id, title, release_date, price) VALUES ($1, $2, $3, $4, $5)', album);
                }
                for (const song of tableData.song) {
                    await adapter.query('INSERT INTO song (song_id, album_id, title) VALUES ($1, $2, $3)', song);
                }
            });

            describe('testConnection', function () {
                it('should resolve', function () {
                    return expect(adapter.testConnection()).resolves.toBeUndefined();
                });
            });

            describe('getCollectionNames', function () {
                it('should resolve to a list of collection names', function () {
                    const expected = ['album', 'artist', 'song'];

                    return expect(adapter.getCollectionNames()).resolves.toEqual(expected);
                });
            });

            describe('getCollectionSchema', function () {
                it('should return the list of columns of album', function () {
                    return expect(adapter.getCollectionSchema('album')).resolves.toEqual({
                        columns: [
                            { name: 'album_id', type: 'number' },
                            { name: 'artist_id', type: 'number' },
                            { name: 'title', type: 'string' },
                            { name: 'release_date', type: 'date' },
                            { name: 'price', type: 'number' },
                        ],
                    });
                });

                it('should return the list of columns of song', function () {
                    return expect(adapter.getCollectionSchema('song')).resolves.toEqual({
                        columns: [
                            { name: 'song_id', type: 'number' },
                            { name: 'album_id', type: 'number' },
                            { name: 'title', type: 'string' },
                        ],
                    });
                });
            });

            describe('getSqlQuerySchema', function () {
                it('should return the list of columns', function () {
                    const sql = 'SELECT song.song_id, song.title, album.title AS album_title, album.release_date ' +
                        'FROM song JOIN album ON (song.album_id = album.album_id)';

                    return expect(adapter.getSqlQuerySchema(sql)).resolves.toEqual({
                        columns: [
                            { name: 'song_id', type: 'number' },
                            { name: 'title', type: 'string' },
                            { name: 'album_title', type: 'string' },
                            { name: 'release_date', type: 'date' },
                        ],
                    });
                });

                it('should throw the error message returned by mysql', function () {
                    const sql = 'a';

                    return expect(adapter.getSqlQuerySchema(sql)).rejects.toThrow('syntax error');
                });
            });

            describe('getQueryResults', function () {
                const tests = require('./__data__/tests.js')('pg');
                it.each(tests)('%s', async function (name, query, expected) {
                    const results = await adapter.getQueryResults(query);

                    expect(results.data).toEqual(expected);
                });
            });
        });
    }
});
