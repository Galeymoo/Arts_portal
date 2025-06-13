const { Artwork, User, Comment, Like } = require('../models');
const { Op } = require('sequelize');
const path = require('path');

// Helper to get likes data
async function getLikesData(artworkId, userId) {
  const likesCount = await Like.count({ where: { artwork_id: artworkId } });
  const liked = await Like.findOne({ where: { artwork_id: artworkId, user_id: userId } });
  return { likes: likesCount, liked: !!liked };
}

// GET feed of all artworks
exports.feed = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const artworks = await Artwork.findAll({
      include: [{ model: User, as: 'author', attributes: ['name', 'email'] }],
      order: [['created_at', 'DESC']]
    });

    });

    for (const artwork of artworks) {
      const comments = await Comment.findAll({
        where: { artwork_id: artwork.id },
        include: [{ model: User, as: 'author', attributes: ['name'] }],
        order: [['created_at', 'ASC']]
      });

      const likesData = await getLikesData(artwork.id, userId);
      artwork.dataValues.comments = comments;
      artwork.dataValues.likes = likesData.likes;
      artwork.dataValues.liked = likesData.liked;
    }

    res.render('artworks/feed', { artworks });
  } catch (err) {
    console.error('Error fetching artworks:', err);
    res.status(500).send('Error fetching artworks');
  }
};

// GET artworks uploaded by current user
exports.myArtworks = async (req, res) => {
  try {
    const userId = req.session.user.id;

    const artworks = await Artwork.findAll({
      where: { user_id: userId },
      include: [{ model: User, as: 'author', attributes: ['name', 'email'] }],
      order: [['created_at', 'DESC']]
    });

    for (const artwork of artworks) {
      const comments = await Comment.findAll({
        where: { artwork_id: artwork.id },
        include: [{ model: User, as: 'author', attributes: ['name'] }],
        order: [['created_at', 'ASC']]
      });

      const likesData = await getLikesData(artwork.id, userId);
      artwork.dataValues.comments = comments;
      artwork.dataValues.likes = likesData.likes;
      artwork.dataValues.liked = likesData.liked;
    }

    res.render('artworks/myArtworks', { artworks, editingId: null });
  } catch (err) {
    console.error('Error fetching your artworks:', err);
    res.status(500).send('Error fetching your artworks');
  }
};

// GET view for editing an artwork
exports.editMyArtworksView = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const editingId = parseInt(req.params.id, 10);

    const artworks = await Artwork.findAll({
      where: { user_id: userId },
      include: [{ model: User, as: 'author', attributes: ['name', 'email'] }],
      order: [['created_at', 'DESC']]
    });

    for (const artwork of artworks) {
      const comments = await Comment.findAll({
        where: { artwork_id: artwork.id },
        include: [{ model: User, as: 'author', attributes: ['name'] }],
        order: [['created_at', 'ASC']]
      });

      const likesData = await getLikesData(artwork.id, userId);
      artwork.dataValues.comments = comments;
      artwork.dataValues.likes = likesData.likes;
      artwork.dataValues.liked = likesData.liked;
    }

    res.render('artworks/myArtworks', { artworks, editingId });
  } catch (err) {
    console.error('Error loading edit view:', err);
    res.status(500).send('Error loading edit view');
  }
};

// POST update artwork
exports.updateArtwork = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const artworkId = parseInt(req.params.id, 10);
    const { title, description } = req.body;

    const artwork = await Artwork.findByPk(artworkId);

    if (!artwork) return res.status(404).send('Artwork not found');
    if (artwork.user_id !== userId) return res.status(403).send('Unauthorized');

    await artwork.update({ title, description });

    res.redirect('/my-artworks');
  } catch (err) {
    console.error('Error updating artwork:', err);
    res.status(500).send('Error updating artwork');
  }
};

// POST upload artwork
exports.uploadArtwork = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { title, description } = req.body;
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

    if (!title || !imageUrl) {
      return res.status(400).send('Title and artwork image are required');
    }

    await Artwork.create({
      title,
      description,
      image_url: imageUrl,
      user_id: userId
    });

    res.redirect('/my-artworks');
  } catch (err) {
    console.error('Error uploading artwork:', err);
    res.status(500).send('Error uploading artwork');
  }
};

// GET view single artwork
exports.viewArtwork = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const artworkId = req.params.id;

    const artwork = await Artwork.findByPk(artworkId, {
      include: [{ model: User, as: 'author', attributes: ['name'] }]
    });

    if (!artwork) return res.status(404).send('Artwork not found');

    const comments = await Comment.findAll({
      where: { artwork_id: artworkId },
      include: [{ model: User, as: 'author', attributes: ['name'] }],
      order: [['created_at', 'ASC']]
    });

    const likesData = await getLikesData(artworkId, userId);

    artwork.dataValues.comments = comments;
    artwork.dataValues.likes = likesData.likes;
    artwork.dataValues.liked = likesData.liked;

    res.render('artworks/view', { artwork, comments });
  } catch (err) {
    console.error('Error viewing artwork:', err);
    res.status(500).send('Error viewing artwork');
  }
};

// POST like/unlike artwork
exports.likeArtwork = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const artworkId = req.params.id;

    const existingLike = await Like.findOne({ where: { artwork_id: artworkId, user_id: userId } });

    if (existingLike) {
      await existingLike.destroy();
    } else {
      await Like.create({ artwork_id: artworkId, user_id: userId });
    }

    const likesCount = await Like.count({ where: { artwork_id: artworkId } });

    res.json({ liked: !existingLike, likes: likesCount });
  } catch (err) {
    console.error('Error processing like:', err);
    res.status(500).send('Error processing like');
  }
};

// POST comment on artwork
exports.commentArtwork = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const artworkId = req.params.id;
    const { comment } = req.body;

    if (!comment || comment.trim() === '') {
      return res.status(400).send('Comment cannot be empty');
    }

    await Comment.create({
      artwork_id: artworkId,
      user_id: userId,
      text: comment.trim()
    });

    res.redirect(`/artworks/${artworkId}`);
  } catch (err) {
    console.error('Error posting comment:', err);
    res.status(500).send('Error posting comment');
  }
};

// DELETE artwork
exports.deleteArtwork = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const artworkId = req.params.id;

    const artwork = await Artwork.findByPk(artworkId);

    if (!artwork) return res.status(404).json({ success: false, message: 'Artwork not found' });
    if (artwork.user_id !== userId) return res.status(403).json({ success: false, message: 'Unauthorized' });

    await artwork.destroy();

    res.json({ success: true, message: 'Artwork deleted successfully' });
  } catch (err) {
    console.error('Error deleting artwork:', err);
    res.status(500).json({ success: false, message: 'Error deleting artwork' });
  }
};
