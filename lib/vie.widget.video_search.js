// VIE Widgets - Vienna IKS Editable Widgets
// (c) 2011 Sebastian Germesin, IKS Consortium
// VIE Widgets may be freely distributed under the MIT license.
// (see LICENSE)

(function($, undefined) {
    $.widget('view.vieVideoSearch', {
        
        _create: function () {
            //extend VIE with an ontological representation of the images
            var v = this.options.vie;
			if (v.types.get("VideoObject").attributes.get("depicts") !== undefined) {
				v.types.get("VideoObject").attributes.add("depicts", ["Thing"]);
				v.types.get("Thing").attributes.get("video").range.push("VideoObject");
				v.types.add("VIEVideoResult", [
				   {
				   "id"    : "query",
				   "range" : ["Text", "Thing"]
				   },
				   {
				   "id"    : "service",
				   "range" : ["Text", "Thing"]
				   },
				   {
					"id"    : "time",
					"range" : "Date"
				   },
				   {
					"id"    : "entity",
					"range" : "Thing"
				   }]
				).inherit(v.types.get("Thing"));
			}
            return this;
        },
        
        _init: function () {
            this.triggerSearch(this.options.entity);
        },
        
        render: function (data) {
            data.time = (data.time)? data.time : new Date();
            if (data.queryId === this.options.query_id) {
                for (var p = 0; p < data.objects.length; p++) {
                    /* TODO : this._triplifyVideo(data.objects[p], data.time, data.serviceId, data.entityId, data.queryId); */
                    this.options.objects.push(data.objects[p]);
                }
                var render = (this.options.render)? this.options.render : this._render;
                if (render) {
                    render.call(this, data);
                } else {
                    console.log("vie.widget.video_search", "No render method specified!");
                }
            } else {
                //discard results as they depend on an old query
            }
        },
        
        /* TODO
        _render: function (data) {
            var self = this;
            
            var videos = self.options.videos;
            var time = data.time;
            
            // clear the container element
            $(self.element).empty();
                        
            //rendering
            for (var p = 0; p < videos.length && p < this.options.bin_size; p++) {
                var photo = videos[p];
                var image = $('<a class="' + self.widgetBaseClass + '-image" target="_blank" href="' + photo.original + '"></a>')
                    .append($("<img src=\"" + photo.thumbnail + "\" />"));
                $(self.element).append(image);
            }
            return this;
        },*/
        
        triggerSearch: function (entityId, pageNum) {
            var self = this;
            
            if (this.options.timer) {
                clearTimeout(this.options.timer);
            }
            this.options.query_id++;
            var qId = this.options.query_id;
            this.options.objects = [];
            this.options.page_num = (pageNum)? pageNum : 0;
            
            var entity = undefined;
            if (typeof entityId === "string") {
                entity = this.options.vie.entities.get(entityId);
            } else {
                entity = entityId;
            }

            if (entity) {
                var queryPerformed = false;
                for (var s in this.options.services) {
                    var service = this.options.services[s];
                    if (service.use) {
                        this._trigger('start_query', undefined, {entity: entity, service: s, time: new Date(), queryId : qId});
                        service.query(entity, s, this, qId);
                        queryPerformed = true;
                    }
                }
                if (queryPerformed) {
                    this.options.timer = setTimeout(function (widget) {
                        return function () {
                            // discard all results that return after this timeout happened
                            widget.options.query_id++;
                        };
                    }(this), this.options.timeout, "JavaScript");
                }
            } else {
                this._trigger('error', undefined, {msg: "Entity needs to be registered in VIE.", id : entityId});
            }
            return this;
        },
        
        /* TODO
        _triplifyVideo: function (photo, time, serviceId, entityId, queryId) {
            var entity = this.options.vie.entities.get(entityId);
            
            var imageId = "<" + photo.original + ">";
            this.options.vie.entities.addOrUpdate({
                '@subject' : imageId, 
                '@type'    : "VideoObject",
                "time"     : time.toUTCString(),
                "query"    : queryId,
                "service"  : serviceId,
                "entity"   : entity.id,
                "image"    : photo.original
            });
            entity.setOrAdd('video', imageId);
        },*/
        
        _getUrlMainPartFromEntity : function (entity, serviceId) {
            var service = this.options.services[serviceId];
            
            entity = ($.isArray(entity))? entity : [ entity ];

            for (var e = 0; e < entity.length; e++) {
                var types = entity[e].get('@type');
                types = ($.isArray(types))? types : [ types ];
                
                for (var t = 0; t < types.length; t++) {
                    var type = this.options.vie.types.get(types[t]);
                    if (type) {
                        var tsKeys = [];
                        for (var q in this.options.ts_url) {
                            tsKeys.push(q);
                        }
                        //sort the keys in ascending order!
                        tsKeys = this.options.vie.types.sort(tsKeys, false);
                        for (var q = 0; q < tsKeys.length; q++) {
                            var key = tsKeys[q];
                            if (type.isof(key) && this.options.ts_url[key][serviceId]) {
                                var ret = this.options.ts_url[key][serviceId].call(this, entity[e], serviceId);
                                if (ret) {
                                    return ret;
                                }
                            }
                        }
                    }
                }
            }
            return "";
        },
        
        options: {
            vie         : new VIE(),
            timeout     : 10000,
            bin_size    : 8,
            lang_id     : "en",
            services    : {
                'gvideo' : {
                    use       : false,
                    api_key   : undefined,
                    base_url  : "https://ajax.googleapis.com/ajax/services/search/video?v=1.0",
                    tail_url  : function (widget, service) {
                        var url = "&rsz=" + widget.options.bin_size;
                        url += "&hl=" + widget.options["lang_id"];
                        url += "&start=" + (widget.options.page_num * widget.options.bin_size);
                        
                        return url;
                    },
                    query : function (entity, serviceId, widget, queryId) {
                        // assemble the URL
                        
                        var mainUrl = widget._getUrlMainPartFromEntity(entity, serviceId);
                        
                        if (mainUrl) {
                            var url = this.base_url;
                            url += mainUrl;
                            url += this.tail_url(widget, this);
                            // trigger the search & receive the data via callback
                            jQuery.getJSON(url,null,this.callback(widget, entity.id, serviceId, queryId));
                        } else {
                            widget._trigger("error", undefined, {
                                msg: "No type-specific URL can be acquired for entity. Please add/overwrite widget.options[<widget_type>][" + serviceId + "]!", 
                                id : entityId, 
                                service : serviceId, 
                                queryId : queryId});
                        }
                    },
                    callback  : function (widget, entityId, serviceId, queryId) {
                        return function (data) {
                            var objects = [];
                            if (data && data.responseStatus === 200) {
                                var rData = data.responseData.results;
                                for (var r = 0; r < rData.length; r++) {
                                    var thumbnail = rData[r].tbUrl;
                                    var embedUrl = (rData[r].videoType === "YouTube")? 
                                                        rData[r].playUrl.replace(/\/v\//, "/embed/").replace(/&.*/, "") : 
                                                        rData[r].playUrl;
                                    var obj = {
                                        "thumbnail" : thumbnail,
                                        "original"  : embedUrl,
                                        "width"     : rData[r].tbWidth,
                                        "height"    : rData[r].tbHeight
                                    };
                                    objects.push(obj);
                                }
                            }
                            var data = {entityId : entityId, serviceId: serviceId, queryId : queryId, time: new Date(), objects: objects, original : data};
                            widget._trigger('end_query', undefined, data);
                            widget.render(data);
                          };
                    }
                }, 
                'youtube' : {
                    use       : false,
                    api_key   : undefined,
                    base_url  : "https://gdata.youtube.com/feeds/api/videos?v=2",
                    tail_url  : function (widget, service) {
                    	var url = "&max-results=" + widget.options.bin_size;
                        url += "&lang=" + widget.options["lang_id"];
                        url += "&alt=json";
                        
                        return url;
                    },
                    query : function (entity, serviceId, widget, queryId) {
                        // assemble the URL
                        
                        var mainUrl = widget._getUrlMainPartFromEntity(entity, serviceId);
                        
                        if (mainUrl) {
                            var url = this.base_url;
                            url += mainUrl;
                            url += this.tail_url(widget, this);
                            // trigger the search & receive the data via callback
                            jQuery.getJSON(url,null,this.callback(widget, entity.id, serviceId, queryId));
                        } else {
                            widget._trigger("error", undefined, {
                                msg: "No type-specific URL can be acquired for entity. Please add/overwrite widget.options[<widget_type>][" + serviceId + "]!", 
                                id : entityId, 
                                service : serviceId, 
                                queryId : queryId});
                        }
                    },
                    callback  : function (widget, entityId, serviceId, queryId) {
                        return function (data) {
                            var objects = [];
                            if (data && data.feed) {
                                var rData = data.feed.entry;
                                for (var r = 0; r < rData.length; r++) {
                                    var thumbnail = rData[r]["media$group"]["media$thumbnail"][0]["url"];
                                    var embedUrl = rData[r]["media$group"]["media$player"]["url"].replace(/\/v\//, "/embed/").replace(/&.*/, "");
                                    var obj = {
                                        "id" : rData[r]["media$group"]["yt$videoid"]["$t"],
                                        "thumbnail" : thumbnail,
                                        "original"  : embedUrl,
                                        "width"     : rData[r].tbWidth,
                                        "height"    : rData[r].tbHeight,
                                        "title"     : rData[r]["media$group"]["media$title"]["$t"]
                                    };
                                    objects.push(obj);
                                }
                            }
                            var data = {entityId : entityId, serviceId: serviceId, queryId : queryId, time: new Date(), objects: objects, original : data};
                            widget._trigger('end_query', undefined, data);
                            widget.render(data);
                          };
                    }
                }
            },
            ts_url : {
                "Thing" : {
                	'gvideo' : function (entity, serviceId) {
                        var url = "";
                        var name = VIE.Util.extractLanguageString(entity, ["rdfs:label", "name"], [this.options["lang_id"]]);
                        if (name) {
                            url += "&q=";
                            url += encodeURI(name.replace(/ /g, '+'));
                        } else {
                            return undefined
                        }
                        return url;
                    },
                    'youtube' : function (entity, serviceId) {
                        var url = "";
                        var name = VIE.Util.extractLanguageString(entity, ["rdfs:label", "name"], [this.options["lang_id"]]);
                        if (name) {
                            url += "&q=";
                            url += encodeURI(name.replace(/ /g, '+'));
                        } else {
                            return undefined
                        }
                        return url;
                    }
                }
            },
            
            // helper
            render      : undefined,
            entity      : undefined,
            objects      : [],
            timer       : undefined,
            page_num    : 1,
            query_id    : 0,
            
            // events
            start_query : function () {},
            end_query   : function () {},
            error       : function () {}
        }
        
    });
})(jQuery);
