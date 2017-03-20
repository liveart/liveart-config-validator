const HTTP = require('http'),
	  FS = require('fs'),
	  JSON_NAMES = ['MAIN config', 'FONTS config','COLORS config','TEXT EFFECTS config','GRAPHICS config','PRODUCTS config'],
	  JSON_SCHEMAS_URLS = ['./schemas/config_schema.json', './schemas/fonts_schema.json','./schemas/colors_schema.json','./schemas/textEffects_schema.json','./schemas/graphics_schema.json','./schemas/products_schema.json'],
	  LOG_FILE = 'log-' + (new Date().getTime().toString()) + '.txt',
	  MAIN_CONFIG_URL = process.argv.slice(2).toString(),
	  MAIN_CONFIG_IDX = 0;

var Validator = require('jsonschema').Validator,
	v = new Validator(),
	json_schemas = [],
	jsons_urls = [];

function readConfig(url) {
	return new Promise(function(resolve, reject) {
		var resulting_json;
		var request = HTTP.get(url, function(response) {
			var statusCode = response.statusCode;
			if (statusCode !== 200) {
				error = new Error('Request Failed. Url "' + url +'" replied with status code:' + statusCode);
				reject(error);
			} else {
				var body = '';
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
		json_schemas = getSchemas();
	}
	JSONValidation(json, json_schemas[configIdx], JSON_NAMES[configIdx]);
}

function getSchemas() {
	var json_schemas = [];
	for (var i = 0, array_length = JSON_SCHEMAS_URLS.length; i < array_length; i++) {
		json_schemas.push(getJSON(JSON_SCHEMAS_URLS[i]));
	}
	return json_schemas;
}

function getJSON(url) {
	var json = '';
	try {
		json = JSON.parse(FS.readFileSync(url,'utf8'));
	} catch (error) {
		console.log('Could not parse "' + url + '" json. Details: ' + error.message);
		return false;
	}
	return json;
}

function addToLog(info) {
	FS.appendFileSync(LOG_FILE, info + '\n', encoding='utf8');
}

function JSONValidation(json, schema, config_name) {
	var errors = v.validate(json, schema)["errors"];
	addToLog('Validating ' + config_name + '...');
	console.log('Validating ' + config_name + '...\nResult:');
	if (errors.length != 0) {
		addToLog('Result: Validation failed!\n\nDetails:');
		console.log('Validation FAILED!\n(See "' + LOG_FILE + '" for details)');
		for (var i=0, errors_length = errors.length; i < errors_length; i++) {
			addToLog(errors[i]["stack"]);
			console.log(errors[i]["stack"]);
		}
	} else {
		addToLog('Result: Validation succeeded!');
		console.log('Validation SUCCEEDED!');
	}
	addToLog('----------------------------------------------------------------------------------\n');
}

console.log('\n//////////////////          START CONFIGS VALIDATION           //////////////////\n\n');
readConfig(MAIN_CONFIG_URL)
.then(
	(result) => {
		parseConfig(result, MAIN_CONFIG_IDX);
	},
	(error) => {
		console.log('Rejected main config: ' + error);
	})
.then(
	() => {
		jsons_urls.forEach(function(url, index) {
			index++;
			readConfig(url)
			.then(
				(result) => {
					parseConfig(result, index);
					console.log(JSON_NAMES[index] + ' validation complete!');
					console.log('********************************************************************************\n');
				},
				(error) => {console.log('Error happend: '+ error);}
			);
		});
	}
).catch(error => {
    console.log(error);
});
