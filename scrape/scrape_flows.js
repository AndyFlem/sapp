const axios = require('axios').default
const { DateTime } = require("luxon")

var pg = require('pg')

const knex = require('knex')({
  client: 'pg',
  version: '10',
  debug: true,
  connection: {
    host: '127.0.0.1',
    user: 'postgres',
    password: 'extramild20',
    database: 'sapp'
  }
})


getFlows().then(() => {

  console.log('OK')

})

async function getFlows() {

  let curDate = DateTime.fromISO('2016-01-01')

  while (curDate < DateTime.fromISO( '2016-01-05')) //'2021-03-31"'))
  {
    let market = 1
    while (market < 5) {
      const url=`http://www.sappmarket.com/Home/GetFlow?deliveryDate=${curDate.toFormat('yyyy/LL/dd')}&periodId=0&categoryId=18&marketId=${market}`
      console.log(url)
    
      let response = await axios.get(url)
      //console.log(response.data.excelData)      
    
      knex('flows')
        .where({flowdate: curDate.toISODate, market: market})
        .delete()

      response.data.excelData.forEach(e => {
        console.log(e)
        knex('flows')
          .insert({flowdate: curDate.toISODate, market: market, flow: e[2], from: e[0],to: e[1]})
      })

      curDate=curDate.plus({ days: 1 })
      market++
    }
  }
  
  
  return Promise.resolve()

}
