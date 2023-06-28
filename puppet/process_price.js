const { DateTime, Interval } = require("luxon")
const fs = require('fs');

const prefs=['dam','fpm','fpw', 'idm']
const market = 1


const in_folder = '../input/price/' + prefs[market-1]