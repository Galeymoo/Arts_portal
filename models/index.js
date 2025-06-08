const sequelize = require('../config/db');

// Import models
const User = require('./user');
const Artwork = require('./artwork');
const Comment = require('./comment');
const Like = require('./like');

// Define associations
Artwork.belongsToMany(User, { through: Like, foreignKey: 'artworkId', as: 'usersWhoLiked' });
User.belongsToMany(Artwork, { through: Like, foreignKey: 'userId', as: 'userLikedArtworks' });


const db = { sequelize, User, Artwork, Comment, Like };

module.exports = db;
