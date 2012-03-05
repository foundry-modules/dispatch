/*!
 * Dispatch
 * Mediator of Foundry libraries.
 *
 * Copyright (c) 2012 Jason Ramos
 * www.stackideas.com
 *
 * Dual licensed under the MIT and GPL licenses:
 * http://www.opensource.org/licenses/mit-license.php
 * http://www.gnu.org/licenses/gpl.html
 *
 */

(function(window, undefined) {

	var uid = function(p,s) {
		return ((p) ? p : '') + Math.random().toString().replace('.','') + ((s) ? s : '');
	}

	var dispatch = window.dispatch = function(manifest, exports) {

		var setter = false;

		// If it's an object, it is a setter operation.
		if (typeof manifest==="object") {

			if (typeof manifest.name===undefined) {
				return;
			}

			setter = true;
		}

		// If it's a string, it could be a getter or a setter.
		if (typeof manifest==="string") {

			manifest = {
				name: manifest
			}
		}

		// Find the parcel in our registry
		var parcel = dispatch.parcels[manifest.name];

		// If this is a new parcel
		if (parcel===undefined) {

			// Create the parcel and put it in our registry
			parcel = dispatch.parcels[manifest.name] = new Parcel(manifest.name);

			// Add a variation of the parcel
			parcel.add(manifest, exports);

		// If it's a setter operation, add a variation of the parcel.
		} else if (setter) {

			parcel.add(manifest, exports);
		}

		// If it's a setter operation, the parcel is always the latest one.
		// If it's a getter operation, automatically get the latest variation.
		return parcel.get();
	}

	// Parcel registry
	dispatch.parcels = {};

	// Dropsite registry
	dispatch.dropsite = {};

	// Internal function. Do not use.
	dispatch.deliver = function(parcel, site) {

		var parcelContainsExports = parcel.exports!==undefined,
			parcelUnsent = !parcel.sentTo[site.id],
			dropsiteHasTarget = site.target;

		if (parcelContainsExports && parcelUnsent && dropsiteHasTarget) {

			site.target.apply(window, parcel.exports, parcel.manifest);

			return parcel.sentTo[site.id] = true;
		}

		// Push it to the list of parcel that is yet to be sent
		if (!dropsiteHasTarget) {
			dropsite.parent.parcels.push(parcel);
		}

		return false;
	}

	// Getting a dropsite.
	dispatch.to = function(name) {

		if (name===undefined) return;

		return dispatch.dropsite[name] || (dispatch.dropsite[name] = new Dropsite(name));
	}

	// Dropsite class

	var Dropsite = function(name) {
		this.name = name;
		this.sites = {};
		this.parcels = [];
	};

	// Dispatch.to("name").at(dropsite);
	// Adds a new dropsite to a recipient.
	// One recipient can have many dropsites.

	Dropsite.prototype.at = function(site) {

		if (typeof site === "function") {

			var siteId = uid(this.name+"/");

			// Create a new target to the dropsite
			this.sites[siteId] = {
				id: siteId,
				parent: this,
				target: site
			};

			// Go through every existing parcel for this dropsite,
			// and drop it at the new target.
			var i;
			for (i=0; i<this.parcels.length; i++) {

				var parcel = this.parcels[i];

				dispatch.deliver(parcel, site);
			}
		}

		return this;
	}

	// Parcel class

	var Parcel = function(manifest) {

		this.name = manifest.name;
		this.sentTo = {};
		this.dropsites = [];

		// The rest of the operation is done in .add() called manually.
	}

	Parcel.prototype.add = function(manifest, exports) {

		return this.parcels.push({
			manifest: manifest,
			exports: exports
		});
	}

	Parcel.prototype.get = function() {

		// Reset lock
		this.indexLocked = false;

		this.index = this.parcels.length - 1;

		return this;
	}

	// Getter
	Parcel.prototype.intendedFor = function(name) {

		var parcel;

		for (i in parcels) {

			parcel = parcels[i];

			if (parcel.recipient==name) {

				this.index = i;

				this.indexLocked = true;

				return this;
			}
		}
	}

	// Setter for parcel exports
	Parcel.prototype.containing = function(exports) {

		// .intendedFor() was called before this,
		// it is a getter not setter operation.
		if (this.indexLocked) {

			return this;
		}

		var parcel = this.parcels[this.index];

		// If a dispatch already contains export
		if (parcel.exports!==undefined) {

			// Create another variation instead,
			// also set the index to this variation.
			this.index = this.add({name: this.name}, exports) - 1;

		} else {

			// Else add to the current variation.
			parcel.exports = exports;
		}

		return this;
	}

	// Getter or setter
	Parcel.prototype.to = function(dropsite, forceDeliver) {

		// Don't do anything when no dropsite is given
		if (dropsite===undefined) {
			return this;
		}

		// Get the right parcel
		parcel = this.parcels[this.index];

		// If a dropsite name is given
		if (typeof dropsite==="string") {

			// Resolve dropsite
			var name = dropsite;
			dropsite = dispatch.to(name);  // .withParcel(parcel);
		}

		// If a dropsite target is given
		if (typeof dropsite==="function") {

			// Create a dropsite entry first
			dropsite = dispatch.to(uid("Custom dropsite for: " + parcel.name + "[" + uid() + "]")).at(dropsite);
		}

		// Keep a copy of the dropsite
		this.dropsites.push(dropsite);

		// If the parcel is locked, don't deliver,
		// except if being forced.
		if (this.dropsiteLocked && forceDeliver) {

			// Attempt to deliver
			dispatch.deliver(parcel, dropsite);

		} else {

			// This will ensure previous undelivered dropsite
			// gets delivered first before the current dropsite.
			this.toAll();
		}

		return this;
	}

	Parcel.prototype.onlyTo = function(dropsite) {

		this.dropsiteLocked = true;

		this.to(dropsite, true);

		return this;
	}

	Parcel.prototype.toAll = function() {

		this.dropsiteLocked = false;

		var parcel = this.parcels[this.index],
			dropsites = this.dropsites,
			i;

		// Go through every parcel and deliver its content
		for (i=0; i<dropsites.length; i++) {

			var dropsite = dropsites[i];

			dispatch.deliver(parcel, dropsite);
		}

		return this;
	}

}(window));
