const HTTP = require('http'),
	  FS = require('fs'),
	  JSON_NAMES = ['MAIN config', 'FONTS config','COLORS config','TEXT EFFECTS config','GRAPHICS config','PRODUCTS config'],
	  JSON_SCHEMAS_URLS = ['./schemas/config_schema.json', './schemas/fonts_schema.json','./schemas/colors_schema.json','./schemas/textEffects_schema.json','./schemas/graphics_schema.json','./schemas/products_schema.json'],
	  LOG_FILE = 'log-' + (new Date().getTime().toString()) + '.txt',
	  MAIN_CONFIG_URL = process.argv.slice(2).toString(),
	  MAIN_CONFIG_IDX = 0;

let Validator = require('jsonschema').Validator,
	v = new Validator(),
	json_schemas = [],
	jsons_urls = [];

function readConfig(url) {
	return new Promise(function(resolve, reject) {
		let resulting_json;
		console.log('Reading "' + url + '" ...');
		let request = HTTP.get(url, function(response) {
			let statusCode = response.statusCode;
			if (statusCode !== 200) {
				error = new Error('Request Failed. Url "' + url +'" replied with status code:' + statusCode);
				reject(error);
			} else {
				let body = '';
				response.on('data', function(chunk) {
					body += chunk;
				});
				response.on('end', function() {
					try {
						resulting_json = JSON.parse(body);
					} catch (error) {
						return reject('Could not parse "' + url + '" json. Details: ' + error.message);
					}					
					resolve(resulting_json);
				});
			}		
		});
		request.onerror = function(error) {
			reject(error);
		}
	});
}

function parseConfig(json, configIdx) {
	if (configIdx == MAIN_CONFIG_IDX) {
		jsons_urls = [json['fonts']['url'], json['colors']['url'], json['textEffects']['url'], json['graphicsList']['url'],json['productsList']['url']];
	}
	addToLog('Validation of ' + JSON_NAMES[configIdx] + '...');
	console.log('Validating ' + JSON_NAMES[configIdx] + '...');
	JSONValidation(json, json_schemas[configIdx]);
}

function getSchemas() {
	let schemas_array = [];
	let json = '';
	for (let i = 0, array_length = JSON_SCHEMAS_URLS.length; i < array_length; i++) {
		try {
			json = JSON.parse(FS.readFileSync(JSON_SCHEMAS_URLS[i],'utf8'));
		} catch (error) {
			console.log('Could not parse "' + JSON_SCHEMAS_URLS[i] + '" json. Details: ' + error.message);
			return [];
		}
		schemas_array.push(json);
	}
	return schemas_array;
}

function addToLog(info) {
	FS.appendFileSync(LOG_FILE, info + '\n', encoding='utf8');
}

function JSONValidation(json, schema) {
	let errors = v.validate(json, schema)["errors"];
	if (errors.length != 0) {
		addToLog('Result: Validation failed!\n\nDetails:');
		console.log('Result: Validation FAILED!\n(See "' + LOG_FILE + '" for details)');
		for (let i=0, errors_length = errors.length; i < errors_length; i++) {
			addToLog(errors[i]["stack"]);
			console.log(errors[i]["stack"]);
		}
	} else {
		addToLog('Result: Validation succeeded!');
		console.log('Validation SUCCEEDED!');
	}
	addToLog('----------------------------------------------------------------------------------\n');
}

console.log('\n//////////////////          CONFIGS VALIDATION STARTED          //////////////////\n\n');
json_schemas = getSchemas();
if (json_schemas.length > 0) {
	readConfig(MAIN_CONFIG_URL)
	.then(
		(result) => {
			parseConfig(result, MAIN_CONFIG_IDX);
		},
		(error) => {
			console.log('Error happened when reading ' + JSON_NAMES[MAIN_CONFIG_IDX] + ': ' + error + '\n');
		})
	.then(
		() => {
			let chain = Promise.resolve();
			jsons_urls.forEach(function(url, index) {
				index++;
				chain = chain
				.then (() => readConfig(url))
				.then(
					(result) => {
						parseConfig(result, index);
						console.log(JSON_NAMES[index] + ' validation is complete!');
						console.log('********************************************************************************\n');
					},
					(error) => {console.log('Error happened when reading '+ JSON_NAMES[index] +': '+ error + '\n');}
				);
			});
			chain.then(() => {console.log('\n//////////////////          CONFIGS VALIDATION ENDED          //////////////////\n\n');});
		}
	).catch(error => {
		console.log(error);
	});
} else {
	console.log('\n//////////////////          CONFIGS VALIDATION ENDED          //////////////////\n\n');
}
