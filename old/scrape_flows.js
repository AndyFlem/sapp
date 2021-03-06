const axios = require('axios').default
const { DateTime } = require("luxon")

var pg = require('pg')
pg.types.setTypeParser(1082, (value) => DateTime.fromISO(value))

const knex = require('knex')({
  client: 'pg',
  version: '10',
  debug:false,
  connection: {
    host: '127.0.0.1',
    user: 'postgres',
    password: 'extramild20',
    database: 'sapp'
  }
})

const cats=[5,18,19,22]

getFlows().then(() => {
  console.log('OK')
})

async function getFlows() {
  let curDate
  await knex.raw(`SELECT MAX(flowdate) FROM flows`)
    .then(res => {
      console.log(res.rows)
      if (res.rows[0].max) {
        console.log(res.rows[0].max)
        curDate = res.rows[0].max
        curDate=curDate.minus({days: 1})   
      } else {
        curDate = DateTime.fromISO( '2016-01-01')
      }
    })
    .catch(err => { console.log(err) })

  console.log(curDate)

  while (curDate <= DateTime.fromISO( '2021-03-31')) 
  {
    let market = 1
    let period = 1

    const oDel = {flowdate: curDate.toISODate(), market: market}
    console.log(oDel) 
    await knex('flows')
      .where(oDel)
      .delete()
      .catch(err => { console.log(err) })    

    while (period < 25) {
      const url=`http://www.sappmarket.com/Home/GetFlow?deliveryDate=${curDate.toFormat('yyyy/LL/dd')}&periodId=${period}&categoryId=${cats[market-1]}&marketId=${market}`
      console.log(url)
    
      let response = await axios.get(url)
      //console.log(response.data.excelData)      

      await Promise.all(
        response.data.excelData.map(e => {
          const oIns = {flowdate: curDate.toISODate(), market: market, hour: period, flow: e[2], from: e[0],to: e[1]}
          if (e[2]!='Flow Result') {
            // console.log(oIns)
            return knex('flows')
              .insert(oIns)
              .catch(err => { console.log(err) })  
          } else {
            return true
          }
        })
      )
      period++
    }
    curDate=curDate.plus({ days: 1 })
  }
  
  
  return Promise.resolve()

}
