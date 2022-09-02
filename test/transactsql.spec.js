const { expect } = require('chai')
const Parser = require('../src/parser').default

describe('transactsql', () => {
  const parser = new Parser();

  function getParsedSql(sql, opt = { database: 'transactsql' }) {
    const ast = parser.astify(sql, opt);
    return parser.sqlify(ast, opt);
  }

  it('should support select top n', () => {
    const sql = 'select top 3 * from tableA'
    expect(getParsedSql(sql)).to.equal('SELECT TOP 3 * FROM [tableA]')
  })

  it('should support select top n percent', () => {
    const sql = 'select top 3 percent * from tableA'
    expect(getParsedSql(sql)).to.equal('SELECT TOP 3 PERCENT * FROM [tableA]')
  })

  it('should support select count', () => {
    let sql = 'select count(*);'
    expect(getParsedSql(sql)).to.equal('SELECT COUNT(*)')
    sql = 'SELECT COUNT(DISTINCT foo);'
    expect(getParsedSql(sql)).to.equal('SELECT COUNT(DISTINCT [foo])')
    sql = 'SELECT COUNT(*) as foo;'
    expect(getParsedSql(sql)).to.equal('SELECT COUNT(*) AS [foo]')
  })

  it('should support comment before', () => {
    const sql = `-- +migrate Up
    CREATE TABLE test (
      id BIGINT NOT NULL PRIMARY KEY IDENTITY(1, 1)
    );`
    expect(getParsedSql(sql)).to.equal('CREATE TABLE [test] ([id] BIGINT NOT NULL IDENTITY(1, 1) PRIMARY KEY)')
  })

  it('should properly escape column aliases that contain special characters', () => {
    const sql = `select column_name as [Column Name] from table_name`
    expect(getParsedSql(sql)).to.equal('SELECT [column_name] AS [Column Name] FROM [table_name]')
  })

  it('should support exec stmt', () => {
    const sql = `EXEC msdb.dbo.sp_delete_database_backuphistory @database_name = N'Test'
    GO`
    expect(getParsedSql(sql)).to.equal("EXEC [msdb.dbo].[sp_delete_database_backuphistory] @database_name = N'Test' GO")
  })

  it('should support over in aggregation function', () => {
    let sql = `select sum(order_rate) over(
      order by quarter_time
      rows between 4 preceding and 1 preceding -- window frame
    ) as new_sum from t
    `
    expect(getParsedSql(sql)).to.equal("SELECT SUM([order_rate]) OVER (ORDER BY [quarter_time] ASC ROWS BETWEEN 4 PRECEDING AND 1 PRECEDING) AS [new_sum] FROM [t]")
    sql = 'SELECT syscolumns.name, ROW_NUMBER() OVER(PARTITION BY id ORDER BY colid) rowNo from sysColumns'
    expect(getParsedSql(sql)).to.equal("SELECT [syscolumns].[name], ROW_NUMBER() OVER (PARTITION BY [id] ORDER BY [colid] ASC) AS [rowNo] FROM [sysColumns]")
  })

  it('should support status as column or table name, left and right as function name', () => {
    let sql = 'select * from status where 1=1'
    expect(getParsedSql(sql)).to.equal("SELECT * FROM [status] WHERE 1 = 1")
    sql = 'select status from test where 1=1'
    expect(getParsedSql(sql)).to.equal("SELECT [status] FROM [test] WHERE 1 = 1")
    sql = "select LEFT('test',2) ,RIGHT('test', 2) from [test]"
    expect(getParsedSql(sql)).to.equal("SELECT LEFT('test', 2), RIGHT('test', 2) FROM [test]")
  })

  it('should support distinct without parentheses', () => {
    const sql = 'select count(DISTINCT ISNULL([email],-1)) from demo'
    expect(getParsedSql(sql)).to.equal("SELECT COUNT(DISTINCT ISNULL([email], -1)) FROM [demo]")
  })

  it('should support drop table if exists', () => {
    const sql = 'DROP TABLE IF EXISTS event_log'
    expect(getParsedSql(sql)).to.equal("DROP TABLE IF EXISTS [event_log]")
  })

  it('should support left join', () => {
    const sql = `select
    trpriv_seq, trpriv_titulo, trpriv_id, trprivc_data
    from termos_privacidade
    left join termos_privacidade_versoes on (trprivv_trpriv_id = trpriv_id and trprivv_unidg_id is null and trprivv_inicio <= '2022-08-16T15:00:04.832Z' and (trprivv_fim >= '2022-08-16T15:00:04.832Z' or trprivv_fim is null))
    left join termos_privacidade_consentimentos on (trprivc_trprivv_id = trprivv_id and trpriv_individual = 0 and trprivc_pes_id = 'null')
    where 1 = 1 AND trprivv_id is not null   AND 1 = 2
    order by 1,2`
    expect(getParsedSql(sql)).to.equal("SELECT [trpriv_seq], [trpriv_titulo], [trpriv_id], [trprivc_data] FROM [termos_privacidade] LEFT JOIN [termos_privacidade_versoes] ON ([trprivv_trpriv_id] = [trpriv_id] AND [trprivv_unidg_id] IS NULL AND [trprivv_inicio] <= '2022-08-16T15:00:04.832Z' AND ([trprivv_fim] >= '2022-08-16T15:00:04.832Z' OR [trprivv_fim] IS NULL)) LEFT JOIN [termos_privacidade_consentimentos] ON ([trprivc_trprivv_id] = [trprivv_id] AND [trpriv_individual] = 0 AND [trprivc_pes_id] = 'null') WHERE 1 = 1 AND [trprivv_id] IS NOT NULL AND 1 = 2 ORDER BY 1 ASC, 2 ASC")
  })

})
