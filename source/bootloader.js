(function(ns){

// Enqueue class
var enqueue = function(fn) {
	var queue = [], locked = 1, working = 0, fn = fn,
		instance = function(){
			queue.push([this, arguments]);
			if (!locked) instance.execute();
		};
		instance.execute = function(){
			if (working) return;
			working = 1; locked = 0;
			var q; while(q = queue.shift()) { fn.apply(q[0], q[1]) };
			working = 0;
		};
		instance.lock = function(){
			locked = 0;
		};

		instance.queue = queue;

	return instance;
};

// Private variables
var $, components = {}, initialized = 0, installers = [];

var self = window[ns] = {

	jquery: function(jquery) {
		if ($) return; // If jquery is already available, stop.
		$ = jquery; // Set self.$ to jquery object
		self.init(); // Try to initialize.
	},

	init: function() {
		if (initialized) return; // If initialized, stop.

		$(document).ready(function(){

			// Read foundry's meta
			var foundryMeta = $('meta[name="%BOOTCODE%"]').attr('content').split(',');
			var props = ['environment','mode', 'path', 'cdn', 'extension', 'cdnPath', 'rootPath', 'basePath', 'indexUrl', 'joomla.location', 'joomla.version', 'joomla.debug', 'joomla.appendTitle','joomla.sitename', 'locale'];
			var foundryOptions = {"joomla": {}};

			$(foundryMeta).each(function(i, val) {
				var key = props[i];

				if (!key) {
					return;
				}

				if (key.match(/joomla\.(.*)/)) {

					var match = key.match(/joomla\.(.*)/)[1];

					foundryOptions['joomla'][match] = val;

				} else {
					foundryOptions[props[i]] = val;
				}
			});

			$.each(components, function(key, component) {
				var meta = $('meta[name="%BOOTCODE%:' + key + '"]');

				if (meta.length < 1) {
					delete window[key];
					delete components[key];
					return;
				}

				// Here is where we neeed to update the component options
				var value = meta.attr('content').split(',');
				var props = ["mode", "version", "baseUrl", "cdn", "token", "ajaxUrl"];
				var componentOptions = {};


				$(value).each(function(i, val) {
					componentOptions[props[i]] = val;
				});

				// Update component with the proper options
				component.options = componentOptions;
			});

			// Only proceed to register the components when both foundry options and jquery is available.
			if ($ && foundryOptions) {
				// Initialize jquery
				self.$ = $.initialize(foundryOptions);

				// Execute any pending plugins
				self.plugin.execute();

				// Get all abstract components
				$.each(components, function(i, component){

				    // If this component is registered, stop.
				    if (component.registered) return;

				    // Create an instance of the component
				    $.Component.register(component);
				});
			}

		});

		initialized = 1;
	},

	plugin: enqueue(function(name, factory) {
		factory.apply(self, [$]);
	}),

	module: enqueue(function(name, factory) {
		$.module(name, factory);
	}),

	installer: function(recipient, name, factory) {
		if (!installers[recipient]) installers[recipient] = []; // Create package array if this is the first time
		if (!name) return installers[recipient];
		var component = components[recipient]; // Get component
		if (component.registered) return component.install(name, factory); // If component exist, install straight away
		installers[recipient].push([name, factory]); // Keep the package to install later
	},

	component: function(name, options) {

		// Getter
		if (!name) return components; // return list of components
		if (!options) return components[name]; // return component

		// Registering
		if (typeof options === "function") {
			var component = options;
			component.registered = true;
			return components[name] = component;
		}

		// Setter
		var queue = [],
			abstractQueue = function(method, context, args) {
				return {method: method, context: this, args: args};
			},
			abstractMethod = function(method, parent, chain) {
				return function(){
					(chain || queue).push(abstractQueue(method, this, arguments));
					return parent;
				};
			},
			abstractInstance = function(instance, methods, chain) {
				var i = 0;
				for (; i < methods.length; i++) {
					var method = methods[i];
					instance[method] = abstractMethod(method, instance, chain);
				};
				return instance;
			},
			abstractChain = function(name, methods) {
				return function(){
					var chain = [abstractQueue(name, this, arguments)];
						queue.push(chain);
					return abstractInstance({}, methods, chain);
				};
			};
			queue.execute = function(){
				var component = components[name], i = 0;
				for (; i < queue.length; i++) {
					var fn = queue[i];
					if (Object.prototype.toString.call(fn)==='[object Array]') {
						var chain = fn, context = component, j = 0;
						for (; j < chain.length; j++) {
							context = context[chain[j].method].apply(context, chain[j].args);
						}
					} else {
						component[fn.method].apply(component, fn.args)
					}
				}
			};

			// Create abstract component
			var component = abstractInstance(
					function() {
						component.run.apply(this.arguments)
					},
					["run","ready","template","dialog"]
				);

				// Set reference to options & queue
				component.className = name;
				component.options = options;
				component.queue = queue;

				// Create abstract module method
				component.module = abstractChain(
					"module",
					["done","always","fail","progress"]
				);

				// Create abstract require method
				component.require = abstractChain(
					"require",
					["library","script","stylesheet","language","template","app","view","done","always","fail","progress"]
				);

		// Register component in global namespace
		window[name] = components[name] = component;

		if (initialized) {
			$.Component.register(component);
		}

		return component;
	}
};

	self.component('EasyBlog', {});

})("%BOOTCODE%");

