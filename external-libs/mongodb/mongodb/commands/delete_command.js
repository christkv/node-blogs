var BaseCommand = require('./base_command').BaseCommand,
  BinaryParser = require('../bson/binary_parser').BinaryParser,
  BSON = require('../bson/bson').BSON,
  inherits = require('sys').inherits;

/**
  Insert Document Command
**/
var DeleteCommand = exports.DeleteCommand = function(collectionName, selector) {
  BaseCommand.call(this);

  this.collectionName = collectionName;
  this.selector = selector;
  this.className = "DeleteCommand";
};

inherits(DeleteCommand, BaseCommand);

DeleteCommand.prototype.getOpCode = function() {
  return BaseCommand.OP_DELETE;
};

/*
struct {
    MsgHeader header;                 // standard message header
    int32     ZERO;                   // 0 - reserved for future use
    cstring   fullCollectionName;     // "dbname.collectionname"
    int32     ZERO;                   // 0 - reserved for future use
    mongo.BSON      selector;               // query object.  See below for details.
}
*/
DeleteCommand.prototype.getCommand = function() {
  // Generate the command string
  return BinaryParser.fromInt(0) + BinaryParser.encode_utf8(this.collectionName) + BinaryParser.fromByte(0) + BinaryParser.fromInt(0) + BSON.serialize(this.selector);
};