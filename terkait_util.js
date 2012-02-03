if (!window.terkait) {
    window.terkait = {};
}

jQuery.extend(window.terkait, {

    _getRangeObject : function() {
        try {
            var selectionObject;
            if (window.getSelection) {
                selectionObject = window.getSelection();
            } else if (document.selection) {
                selectionObject = document.selection.createRange();
            } else {
            	return undefined;
            }
            if (selectionObject.getRangeAt)
                return selectionObject.getRangeAt(0);
            else { // Safari!
                var range = document.createRange();
                range.setStart(selectionObject.anchorNode,
                        selectionObject.anchorOffset);
                range.setEnd(selectionObject.focusNode,
                        selectionObject.focusOffset);
                return range;
            }
        } catch (e) {
            // nothing to be ranged
            return undefined;
        }
    },
    
    _dbpediaLoader : function (parent, entity) {
        //be sure that we query DBPedia only once per entity!
        if (typeof entity === "string" || !entity.has("DBPediaServiceLoad")) {
        	var id = (typeof entity === "string")? entity : entity.id;
            window.terkait.vie
            .load({
                entity : id
            })
            .using('dbpedia')
            .execute()
            .done(
                function(ret) {
                	parent.trigger("rerender");
                }
            );
        }
    },
    
    _filterDups: function (entities, properties) {
    	properties = (_.isArray(properties))? properties : [ properties ];
    	
        for (var i = 0; i < entities.length; i++) {
            var object = entities[i];
            var ids = [];
            for (var p = 0; p < properties.length; p++) {
            	var prop = properties[p];
                if (object.has(prop)) {
                	var tmpIds = object.get(prop);
                	tmpIds = (_.isArray(tmpIds))? tmpIds : [ tmpIds ];
                	//normalisierung auf IDs
                	for (var t = 0; t < tmpIds.length; t++) {
                		var x = tmpIds[t];
                		if (typeof x !== "string") {
                			if (x.isEntity) {
                				x = x.getSubject();
                        		ids.push(x);
                			} else if (x.isCollection) {
                				x.each(function (m) {
                					ids.push(m.getSubject());
                				});
                			} else {
                				throw new Error ("what?");
                			}
                		} else {
                    		ids.push(x);
                		}
                	}
                }
            }
            if (ids.length > 0) {
                for (var j = 0; j < entities.length; j++) {
                    if (i === j) continue;
                    var subject = entities[j];
                    var containedIdx = -1;
                    for (var x = 0; x < ids.length; x++) {
                    	if (entities[j].getSubject() === ids[x]) {
                    		containedIdx = x;
                    		break;
                    	}
                    }
                    if (containedIdx !== -1) {
                    	// that means that entities[i] has a property which points to entities[j]
                    	// unification!!!
                    	window.terkait._unification(object, subject);
                    	entities.splice(i, 1);
                    	i--;
                    	ids.splice(containedIdx, 1);
                    }
                }
                for (var x = 0; x < ids.length; x++) {
                	var newEntity = new window.terkait.vie.Entity({"@subject" : ids[x]});
                	window.terkait._unification(object, newEntity);
                	entities.splice(i, 1, newEntity);
                	console.log("replacing entity", object.getSubject(), "with", newEntity.getSubject());
                }
            }
        }
    },
    
    _unification : function (source, target, properties) {
    	//TODO: filter for non-properties only!
    	for (var attribute in source.attributes) {
    		if (attribute.indexOf("@") !== 0) {
        		if (!target.has(attribute))
        			target.set(attribute, source.get(attribute));
        		else {
        			try {
        				target.setOrAdd(attribute, source.get(attribute));
        			} catch (e) {
        				console.log("could not unify", attribute, e);
        			}
        		}
    		}
    	}
    },
    
    _humanReadable : function (number) {
        number = (_.isArray(number))? number[0] : number;
        
        if (number > 1000000000) {
            return Math.floor(number / 1000000000) + " billion";
        }
        if (number > 1000000) {
            return Math.floor(number / 1000000) + " million";
        }
        if (number > 1000) {
            return Math.floor(number / 1000) + " thousand";
        }
        if (number > 100) {
            return Math.floor(number / 100) + " houndred";
        }
        return number;
    },
    
    _retrieveMap : function(latitude, longitude, mapDiv) {
        var zoom = 8;
		var a = $('<a target="_blank" href="http://maps.google.com/maps?z=' + (zoom+4) + '&q=' + latitude + ',' + longitude + '">');
		
		var map = $('<div>');
		var img_src = 'http://maps.googleapis.com/maps/api/staticmap?&zoom='+zoom+'&size=100x100&sensor=false&markers='+latitude+','+longitude;
        jQuery(map)
        .css({
            "background-image" : "url(" + img_src + ")"
        });
		
		a
		.append(map)
		.appendTo(mapDiv);
    },
    
    _extractString : function(entity, attrs) {
        if (typeof entity !== "string") {
            var possibleAttrs = (_.isArray(attrs))? attrs : [ attrs ];
            for (var p = 0; p < possibleAttrs.length; p++) {
                var attr = possibleAttrs[p];
                if (entity.has(attr)) {
                    var name = entity.get(attr);
                    if (jQuery.isArray(name) && name.length > 0) {
                        for ( var i = 0; i < name.length; i++) {
                            if (name[i].indexOf('@' + window.terkait.settings.language) > -1) {
                                name = name[i];
                                break;
                            }
                        }
                        if (jQuery.isArray(name))
                            name = name[0]; // just take the first
                    }
                    name = name.replace(/"/g, "").replace(/@[a-z]+/, '').trim();
                    return name;
                }
            }
        }
        return "NO NAME";
    },
	
});