var http = require('http'),
	fs = require('fs'),
	Validator = require('jsonschema').Validator,
	v = new Validator(),

	temp_config_file = "./temp/config_main_temp.json",
	timestamp = new Date().getTime().toString(),
	log_file = "log-" + timestamp + ".txt",

	main_config_json_url = process.argv.slice(2).toString(),
	main_config_json = "",
	main_config_json_schema_url =  "./schemas/config_schema.json",
	main_config_json_schema = "",

	json_names = ["FONTS config","COLORS config","TEXT EFFECTS config","GRAPHICS config","PRODUCTS config"],
	json_schemas = [{},{},{},{},{}],
	json_schemas_urls = ['./schemas/fonts_schema.json','./schemas/colors_schema.json','./schemas/textEffects_schema.json','./schemas/graphics_schema.json','./schemas/products_schema.json'],
	jsons_urls = ["","","","",""];

function readConfig(url, dest, cb, idx) {
	return new Promise(function(resolve, reject) {
		var file = fs.createWriteStream(dest);
		var request = http.get(url, function(response) {
			var statusCode = response.statusCode;
			if (statusCode !== 200) {
				error = new Error('Request Failed. Url "' + url +'" replied with status code:' + statusCode);
				reject(error);
			} else {
				response.pipe(file);
				file.on('finish', function() {
					file.close(function(){
						if (cb != null) {
							cb(idx);
						}
						resolve();
					});
				});
			}		
		});
		request.onerror = function(error) {
			file.unlink(dest);
			reject(error);
		}
	});
}
function fillArray(target_array, file_urls) {
	for (var i = 0, array_length = target_array.length; i < array_length; i++) {
		target_array[i] = getJSON(file_urls[i]);
	}
	return target_array;
}

function parseMainConfig() {
	main_config_json = getJSON(temp_config_file);
	jsons_urls = [main_config_json["fonts"]["url"], main_config_json["colors"]["url"], main_config_json["textEffects"]["url"], main_config_json["graphicsList"]["url"], main_config_json["productsList"]["url"]];
	main_config_json_schema = getJSON(main_config_json_schema_url);
	json_schemas = fillArray(json_schemas, json_schemas_urls);
	JSONValidation(main_config_json, main_config_json_schema, "MAIN config");
}

function parseConfigs(configIdx) {
	var filename = "./temp/config_" + configIdx + "_temp.json",
		config_json;
	checkIfFile(filename, function(err, isFile) {
		if (isFile) {
			config_json = getJSON("./temp/config_" + configIdx + "_temp.json");
			JSONValidation(config_json, json_schemas[configIdx], json_names[configIdx]);
		} else return;
	});
}

function getJSON(url) {
	return JSON.parse(fs.readFileSync(url,'utf8'));
}

function addToLog(info) {
	fs.appendFileSync(log_file, info + "\n", encoding='utf8');
}

function JSONValidation(json, schema, config_name) {
	var result = v.validate(json, schema),
		errors = result["errors"];
	addToLog("Validating " + config_name + "...");
	console.log("Validating " + config_name + "...\nResult:");
	if (errors.length != 0) {
		addToLog("Result: Validation failed!\n\nDetails:");
		console.log('Validation FAILED!\n(See "' + log_file + '" for details)');
		for (var i=0, errors_length = errors.length; i < errors_length; i++) {
			addToLog(errors[i]["stack"]);
			console.log(errors[i]["stack"]);
		}
	} else {
		addToLog("Result: Validation succeeded!");
		console.log("Validation SUCCEEDED!");
	}
	addToLog("----------------------------------------------------------------------------------\n");
	console.log("---------------------------------------");
}

function checkIfFile(file, cb) {
  fs.stat(file, function fsStat(err, stats) {
    if (err) {
		if (err.code === 'ENOENT') {
			return cb(null, false);
		} else {
			return cb(err);
		}
    }
    return cb(null, stats.isFile());
  });
}

function deleteTempFiles(filename) {
	checkIfFile(filename, function(err, isFile) {
		if (isFile) {
			fs.unlink(filename, function(err) {
			   if (err) {
					console.log('Deleting file "' + filename + '" caused an error: ' + err);
			   }
			   console.log('File "' + filename + '" has been deleted successfully');
			   console.log("********************************************************************************\n");
			});
		}
	});
}

console.log("\n//////////////////          START CONFIGS VALIDATION           //////////////////\n\n");
readConfig(main_config_json_url, temp_config_file, null, 0)
.then(
	() => {
		parseMainConfig();
	},
	(error) => {
		console.log("Rejected main config: " + error);
	})
.then(
	() => {
		deleteTempFiles(temp_config_file);
		jsons_urls.forEach(function(url, index) {
			readConfig(url, "./temp/config_" + index + "_temp.json", parseConfigs, index)
			.then(
				() => {
					deleteTempFiles("./temp/config_" + index + "_temp.json");
				},
				(error) => {console.log("Error happend: "+ error);}
			);
		});
	}
).catch(error => {
    console.log(error);
});