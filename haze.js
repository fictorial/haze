
*/

var events = require('events')

var _ = require('underscore')
var uuid = require('uuid')

var eventEmitter = new events.EventEmitter()

// { collectionName => { id => doc } }

var collections = {}

function ensureCollection(name) {
  if (!_.has(collections, name)) {
    collections[name] = {}
  }

  return collections[name]
}

// include = [ 'a', 'b', 'c.d.e' ]

function includeReferences(include, doc) {
  _.each(include, function (keypath) {
    var parts = keypath.split('.')
    var key = parts.shift()

    if (_.has(doc, key) && _.isString(doc[key])) {
      var ref = doc[key].split(':')
      doc[key] = getDocument({ collection: ref[0], id: ref[1] })

      if (parts.length > 0) {
        includeReferences(parts.slice(1), doc[key])
      }
    }
  })
}

function createDocument(params) {
  var collection = ensureCollection(params.collection)

  var doc = _.extend(params.doc, {
    id: uuid(),
    version: new Date().getTime()
  })

  collection[doc.id] = doc

  eventEmitter.emit('documentCreated', params.collection, doc)

  return {
    id: doc.id,
    version: doc.version
  }
}

function getDocument(params) {
  var doc = (collections[params.collection] || {})[params.id]

  if (doc !== undefined && !_.isEmpty(param.include)) {
    includeReferences(param.include, doc)
  }

  return doc
}

function updateDocument(params) {
  var collection = collections[params.collection]

  if (collection === undefined) {
    return false
  }

  var replacementDocument = params.doc
  var storedDocument = collection[replacementDocument.id]

  if (storedDocument === undefined ||
      storedDocument.version !== replacementDocument.version) {
    return false
  }

  replacementDocument.version = new Date().getTime()

  collection[replacementDocument.id] = replacementDocument

  eventEmitter.emit('documentUpdated', params.collection, replacementDocument)

  return true
}

// params = {collection:string, id:string}

function destroyDocument(params) {
  var collection = collections[params.collection]

  if (collection === undefined) {
    return false
  }

  var doc = collection[params.id]

  delete collection[params.id]

  eventEmitter.emit('documentDestroyed', params.collection, doc)

  return true
}

// params = {collection:string, id:string, key:string, by:number}

function incrementDocument(params) {
  var doc = (collections[params.collection] || {})[params.id]

  if (doc !== undefined) {
    doc[params.key] = (doc[params.key] || 0) + (params.by || 1)

    eventEmitter.emit('documentIncremented', params.collection, doc)
  }
}

var predicates = {
  eq: function (doc, key, value) {
    return _.has(doc, key) && doc[key] === value
  },

  neq: function (doc, key, value) {
    return _.has(doc, key) && doc[key] !== value
  },

  gt: function (doc, key, value) {
    return _.has(doc, key) && doc[key] > value
  },

  ge: function (doc, key, value) {
    return _.has(doc, key) && doc[key] >= value
  },

  lt: function (doc, key, value) {
    return _.has(doc, key) && doc[key] < value
  },

  le: function (doc, key, value) {
    return _.has(doc, key) && doc[key] <= value
  },

  in: function (doc, key, value) {
    return _.has(doc, key) && doc[key] in value
  },

  nin: function (doc, key, value) {
    return _.has(doc, key) && !(doc[key] in value)
  },

  exists: function (doc, key) {
    return _.has(doc, key)
  },

  nexists: function (doc, key) {
    return !_.has(doc, key)
  },

  prefix: function (doc, key, value) {
    return _.has(doc, key) &&
      (doc[key] + '').match('^' + value)
  },

  contains: function (doc, key, value) {
    return _.has(doc, key) &&
      (doc[key] + '').match(value)
  },

  suffix: function (doc, key, value) {
    return _.has(doc, key) &&
      (doc[key] + '').match(value + '$')
  },

  iprefix: function (doc, key, value) {
    return _.has(doc, key) &&
      (doc[key] + '').match(new RegExp('^' + value, 'i'))
  },

  icontains: function (doc, key, value) {
    return _.has(doc, key) &&
      (doc[key] + '').match(new RegExp(value, 'i'))
  },

  isuffix: function (doc, key, value) {
    return _.has(doc, key) &&
      (doc[key] + '').match(new RegExp(value + '$', 'i'))
  }
}

function queryCollection(params) {
  var docs = _.values(collections[params.collection] || {})

  if (_.isEmpty(docs)) {
    return params.count ? { count: 0 } : { results: [] }
  }

  var allMatches = {}

  _.each(params.where, function (query, index) {
    var predicate = predicates[query[1]]

    if (predicate === undefined) {
      return params.count ? { count: 0 } : { results: [] }
    }

    var key = query[0]
    var value = query[2]

    var matches = _.filter(docs, function (doc) {
      return predicate(doc, key, value)
    })

    if (params.combine === 'or' || index === 0) {
      _.each(matches, function (match) {
        allMatches[match.id] = match
      })
    } else if (params.combine === undefined ||
               params.combine === 'and') {

      _.each(_.keys(allMatches), function (id) {
        if (!_.findWhere(matches, { id:id }))
          delete allMatches[id]
      })
    }
  })

  if (params.count) {
    return { count: _.keys(allMatches) }
  }

  var results = _.values(allMatches)

  if (params.sort) {
    var sortKey = params.sort
    var descending = false

    if (sortKey.charAt(0) === '-') {
      descending = true
      sortKey = sortKey.substr(1)
    }

    results = results.sort(function (a, b) {
      if (a[sortKey] === b[sortKey]) {
        return 0
      }

      if (a[sortKey] < b[sortKey]) {
        return descending ? 1 : -1
      }

      return descending ? -1 : 1
    })
  }

  if (_.has(params, 'skip')) {
    var skip = Math.max(0, parseInt(params.skip, 10) || 0)
    results = results.slice(skip)
  }

  if (_.has(params, 'limit')) {
    var limit = Math.min(results.length, Math.max(0, parseInt(params.limit, 10) || 0))
    results = results.slice(0, limit)
  }

  if (_.has(params, 'include') && !_.isEmpty(params.include)) {
    _.each(results, function (result) {
      includeReferences(param.include, result)
    })
  }

  return { results: results }
}

exports.collections = collections
exports.ensureCollection = ensureCollection
exports.createDocument = createDocument
exports.updateDocument = updateDocument
exports.getDocument = getDocument
exports.destroyDocument = destroyDocument
exports.incrementDocument = incrementDocument
exports.queryCollection = queryCollection
exports.eventEmitter = eventEmitter
