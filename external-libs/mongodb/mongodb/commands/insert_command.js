var BaseCommand = require('./base_command').BaseCommand,
  BinaryParser = require('../bson/binary_parser').BinaryParser,
  BSON = require('../bson/bson').BSON,
  inherits = require('sys').inherits;

/**
  Insert Document Command
**/
var InsertCommand = exports.InsertCommand = function(collectionName, checkKeys) {
  BaseCommand.call(this);

  this.collectionName = collectionName;
  this.documents = [];
  this.checkKeys = checkKeys == null ? true : checkKeys;
  this.className = "InsertCommand";
};

inherits(InsertCommand, BaseCommand);

InsertCommand.prototype.add = function(document) {
  this.documents.push(document);
  return this;
};

InsertCommand.prototype.getOpCode = function() {
  return BaseCommand.OP_INSERT;
};

/*
struct {
    MsgHeader header;             // standard message header
    int32     ZERO;               // 0 - reserved for future use
    cstring   fullCollectionName; // "dbname.collectionname"
    BSON[]    documents;          // one or more documents to insert into the collection
}
*/
InsertCommand.prototype.getCommand = function() {
  var command_string = '';
  for(var i = 0; i < this.documents.length; i++) {
    command_string = command_string + BSON.serialize(this.documents[i], this.checkKeys);
  }
  // Build the command string
  return BinaryParser.fromInt(0) + BinaryParser.encode_utf8(this.collectionName) + BinaryParser.fromByte(0) + command_string;
};