// Contains the FHIRPath Filtering and Projection functions.  (Section 5.2 of
// the FHIRPath 1.0.0 specification).

/**
 *  Adds the filtering and projection functions to the given FHIRPath engine.
 */
const util = require('./utilities');
const {TypeInfo, ResourceNode} = require('./types');
const hashObject = require('./hash-object');
const { deepEqual, maxCollSizeForDeepEqual } = require('./deep-equal');

var engine = {};
engine.whereMacro = function(parentData, expr) {
  if(parentData !== false && ! parentData) { return []; }

  return util.flatten(parentData.filter((x, i) => {
    this.$index = i;
    return expr(x)[0];
  }));
};

engine.extension = function(parentData, url) {
  if(parentData !== false && ! parentData || !url) { return []; }

  return util.flatten(parentData.map((x, i) => {
    this.$index = i;
    const extensions = (x && (x.data && x.data.extension || x._data && x._data.extension));
    if (extensions) {
      return extensions
        .filter(extension => extension.url === url)
        .map(x => ResourceNode.makeResNode(x, 'Extension'));
    }
    return [];
  }));
};

engine.selectMacro = function(data, expr) {
  if(data !== false && ! data) { return []; }
  return util.flatten(data.map((x, i) => {
    this.$index = i;
    return expr(x);
  }));
};

engine.repeatMacro = function(parentData, expr) {
  if(parentData !== false && ! parentData) { return []; }

  let res = [];
  const unique = {};
  const length = parentData.length;
  for(let i = 0; i < length; ++i) {
    let newItems = parentData[i];
    do {
      newItems = expr(newItems)
        .filter(item => {
          const key = hashObject(item);
          const isUnique = !unique[key];
          if (isUnique) {
            unique[key] = true;
          }
          return isUnique;
        });
    } while (res.length < res.push.apply(res, newItems));
  }
  return res;
};

//TODO: behavior on object?
engine.singleFn = function(x) {
  if(x.length == 1){
    return x;
  } else if (x.length == 0) {
    return [];
  } else {
    //TODO: should throw error?
    return {$status: "error", $error: "Expected single"};
  }
};


engine.firstFn = function(x) {
  return x[0];
};

engine.lastFn = function(x) {
  return x[x.length - 1];
};

engine.tailFn = function(x) {
  return x.slice(1, x.length);
};

engine.takeFn = function(x, n) {
  return x.slice(0, n);
};

engine.skipFn = function(x, num) {
  return x.slice(num, x.length);
};

engine.ofTypeFn = function(coll, typeInfo) {
  return coll.filter(value => {
    return TypeInfo.fromValue(value).is(typeInfo);
  });
};

engine.distinctFn = function(x) {
  let unique = [];
  if (x.length > 0) {
    if (x.length > maxCollSizeForDeepEqual) {
      // When we have more than maxCollSizeForDeepEqual items in input collection,
      // we use a hash table (on JSON strings) for efficiency.
      let uniqueHash = {};
      for (let i = 0, len = x.length; i < len; ++i) {
        let xObj = x[i];
        let xStr = hashObject(xObj);
        if (!uniqueHash[xStr]) {
          unique.push(xObj);
          uniqueHash[xStr] = true;
        }
      }
    } else {
      // Otherwise, it is more efficient to perform a deep comparison.
      // Use reverse() + pop() instead of shift() to improve performance and
      // maintain order.
      x = x.concat().reverse();
      do {
        let xObj = x.pop();
        unique.push(xObj);
        x = x.filter(o => !deepEqual(xObj, o));
      } while (x.length);
    }
  }
  return unique;
};

module.exports = engine;
