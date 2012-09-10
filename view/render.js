steal('can/view', function(can){

/**
 * Helper(s)
 */
var attrMap = {
		"class" : "className",
		"value": "value",
		"textContent" : "textContent"
	},
	tagMap = {
		"": "span", 
		table: "tr", 
		tr: "td", 
		ol: "li", 
		ul: "li", 
		tbody: "tr",
		thead: "tr",
		tfoot: "tr",
		select: "option",
		optgroup: "option"
	},
	attributeReplace = /__!!__/g,
	tagToContentPropMap= {
		option: "textContent",
		textarea: "value"
	},
	bool = can.each(["checked","disabled","readonly","required"], function(n){
		attrMap[n] = n;
	}),
	// a helper to get the parentNode for a given element el
	// if el is in a documentFragment, it will return defaultParentNode
	getParentNode = function(el, defaultParentNode){
		return defaultParentNode && el.parentNode.nodeType === 11 ? defaultParentNode : el.parentNode;
	},
	setAttr = function(el, attrName, val){
		// if this is a special property
		if ( attrMap[attrName] ) {
			// set the value as true / false
			el[attrMap[attrName]] = can.inArray(attrName,bool) > -1 ? true  : val;
		} else {
			el.setAttribute(attrName, val);
		}
	},
	getAttr = function(el, attrName){
		return attrMap[attrName]?
			el[attrMap[attrName]]:
			el.getAttribute(attrName);
	},
	// Returns text content for anything other than a live-binding 
	contentText =  function( input ) {	
		
		// If it's a string, return.
		if ( typeof input == 'string' ) {
			return input;
		}
		// If has no value, return an empty string.
		if ( !input && input !== 0 ) {
			return '';
		}

		// If it's an object, and it has a hookup method.
		var hook = (input.hookup &&

		// Make a function call the hookup method.
		function( el, id ) {
			input.hookup.call(input, el, id);
		}) ||

		// Or if it's a `function`, just use the input.
		(typeof input == 'function' && input);

		// Finally, if there is a `function` to hookup on some dom,
		// add it to pending hookups.
		if ( hook ) {
			can.view.pendingHookups.push(hook);
			return '';
		}

		// Finally, if all else is `false`, `toString()` it.
		return "" + input;
	}

can.extend(can.view, {

	pendingHookups: [],

	pending: function() {
		// TODO, make this only run for the right tagName
		if(true  || this.pendingHookups.length) {
			var hooks = this.pendingHookups.slice(0);
			lastHookups = hooks;
			this.pendingHookups = [];
			return can.view.hook(function(el){
				can.each(hooks, function(fn){
					fn(el);
				});
			});
		} else {
			return "";
		}
	},

	/**
	 * @hide
	 * called to setup unescaped text
	 * @param {Number|String} status
	 *   - "string" - the name of the attribute  <div string="HERE">
	 *   - 1 - in an html tag <div HERE></div>
	 *   - 0 - in the content of a tag <div>HERE</div>
	 *   
	 * @param {Object} self
	 * @param {Object} func
	 */
	txt: function(escape, tagName, status, self, func){
		// call the "wrapping" function and get the binding information
		var binding = can.compute.binder(func, self, function(newVal, oldVal){
			// call the update method we will define for each
			// type of attribute
			update(newVal, oldVal);
		});
		
		// If we had no observes just return the value returned by func.
		if(!binding.isListening){
			return (escape || status !== 0? contentEscape : contentText)(binding.value);
		}
		// The following are helper methods or varaibles that will
		// be defined by one of the various live-updating schemes.
		
		// The parent element we are listening to for teardown
		var	parentElement,
			nodeList,
			teardown= function(){
				binding.teardown();
				if ( nodeList ) {
					unregister( nodeList );
				}
			},
			// if the parent element is removed, teardown the binding
			setupTeardownOnDestroy = function(el){
				can.bind.call(el,'destroyed', teardown);
				parentElement = el;
			},
			// if there is no parent, undo bindings
			teardownCheck = function(parent){
				if(!parent){
					teardown();
					can.unbind.call(parentElement,'destroyed', teardown);
				}
			},
			// the tag type to insert
			tag = (tagMap[tagName] || "span"),
			// this will be filled in if binding.isListening
			update,
			// the property (instead of innerHTML elements) to adjust. For
			// example options should use textContent
			contentProp = tagToContentPropMap[tagName];
		
		
		// The magic tag is outside or between tags.
		if ( status === 0 && !contentProp ) {
			// Return an element tag with a hookup in place of the content
			return "<" +tag+can.view.hook(
			escape ? 
				// If we are escaping, replace the parentNode with 
				// a text node who's value is `func`'s return value.
				function(el, parentNode){
					// updates the text of the text node
					update = function(newVal){
						node.nodeValue = ""+newVal;
						teardownCheck(node.parentNode);
					};
					
					var parent = getParentNode(el, parentNode),
						node = document.createTextNode(binding.value);
						
					parent.insertBefore(node, el);
					parent.removeChild(el);
					setupTeardownOnDestroy(parent);
				} 
				:
				// If we are not escaping, replace the parentNode with a
				// documentFragment created as with `func`'s return value.
				function( span, parentNode ) {
					// updates the elements with the new content
					update = function(newVal){
						// is this still part of the DOM?
						var attached = nodes[0].parentNode;
						// update the nodes in the DOM with the new rendered value
						if( attached ) {
							makeAndPut(newVal);
						} else {
							// no longer attached
						}
						teardownCheck(nodes[0].parentNode);
					};
					
					// make sure we have a valid parentNode
					parentNode = getParentNode(span, parentNode);
					// A helper function to manage inserting the contents
					// and removing the old contents
					var nodes,
						makeAndPut = function(val){
							// create the fragment, but don't hook it up
							// we need to insert it into the document first
							var frag = can.view.frag(val, parentNode),
								// keep a reference to each node
								newNodes = can.makeArray(frag.childNodes),
								last = nodes ? nodes[nodes.length - 1] : span;
							
							// Insert it in the `document` or `documentFragment`
							if( last.nextSibling ){
								last.parentNode.insertBefore(frag, last.nextSibling);
							} else {
								last.parentNode.appendChild(frag);
							}
							// nodes hasn't been set yet
							if( !nodes ) {
								can.remove( can.$(span) );
								nodes = newNodes;
								// set the teardown nodeList
								nodeList = nodes;
								register(nodes);
							} else {
								can.remove( can.$(nodes) );
								replace(nodes,newNodes);
							}
						};
						// nodes are the nodes that any updates will replace
						// at this point, these nodes could be part of a documentFragment
					makeAndPut(binding.value, [span]);
					
					
					setupTeardownOnDestroy(parentNode);
					
			}) + "></" +tag+">";
		// In a tag, but not in an attribute
		} else if( status === 1 ) { 
			// remember the old attr name
			var attrName = binding.value.replace(/['"]/g, '').split('=')[0];
			can.view.pendingHookups.push(function(el) {
				update = function(newVal){
					var parts = (newVal|| "").replace(/['"]/g, '').split('='),
						newAttrName = parts[0];
					
					// Remove if we have a change and used to have an `attrName`.
					if((newAttrName != attrName) && attrName){
						removeAttr(el,attrName);
					}
					// Set if we have a new `attrName`.
					if(newAttrName){
						setAttr(el, newAttrName, parts[1]);
						attrName = newAttrName;
					}
				};
				setupTeardownOnDestroy(el);
			});

			return binding.value;
		} else { // In an attribute...
			var attributeName = status === 0 ? contentProp : status;
			// if the magic tag is inside the element, like `<option><% TAG %></option>`,
			// we add this hookup to the last element (ex: `option`'s) hookups.
			// Otherwise, the magic tag is in an attribute, just add to the current element's
			// hookups.
			(status === 0  ? lastHookups : can.view.pendingHookups ).push(function(el){
				// update will call this attribute's render method
				// and set the attribute accordingly
				update = function(){
					setAttr(el, attributeName, hook.render(), contentProp);
				};
				
				var wrapped = can.$(el),
					hooks;
				
				// Get the list of hookups or create one for this element.
				// Hooks is a map of attribute names to hookup `data`s.
				// Each hookup data has:
				// `render` - A `function` to render the value of the attribute.
				// `funcs` - A list of hookup `function`s on that attribute.
				// `batchNum` - The last event `batchNum`, used for performance.
				hooks = can.data(wrapped,'hooks');
				if ( ! hooks ) {
					can.data(wrapped, 'hooks', hooks = {});
				}
				
				// Get the attribute value.
				var attr = getAttr(el, attributeName, contentProp),
					// Split the attribute value by the template.
					parts = attr.split("__!!__"),
					hook;

				
				// If we already had a hookup for this attribute...
				if(hooks[attributeName]) {
					// Just add to that attribute's list of `function`s.
					hooks[attributeName].bindings.push(binding);
				} else {
					// Create the hookup data.
					hooks[attributeName] = {
						render: function() {
							var i =0,
								newAttr = attr.replace(attributeReplace, function() {
									return contentText( hook.bindings[i++].value );
								});
							return newAttr;
						},
						bindings: [binding],
						batchNum : undefined
					};
				}

				// Save the hook for slightly faster performance.
				hook = hooks[attributeName];

				// Insert the value in parts.
				parts.splice(1,0,binding.value);

				// Set the attribute.
				setAttr(el, attributeName, parts.join(""), contentProp);
				
				// Bind on change.
				//liveBind(observed, el, binder,oldObserved);
				setupTeardownOnDestroy(el);
			});
			return "__!!__";
		}
	}

})

});