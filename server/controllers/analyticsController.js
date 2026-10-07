const analyticsModel = require('../models/analyticsModel');

// Vendors only ever see their own numbers; admins see the whole canteen.
function scopeOf(req) {
  const user = req.session.user;
  return user.role === 'vendor' ? { vendorId: user.id } : {};
}

exports.summary = async (req, res, next) => {
  try { res.json(await analyticsModel.summary(scopeOf(req))); }
  catch (err) { next(err); }
};

exports.series = (kind) => async (req, res, next) => {
  try {
    const data = await analyticsModel.series(kind, {
      from: req.query.from,
      to: req.query.to,
      ...scopeOf(req)
    });
    res.json({ data });
  } catch (err) { next(err); }
};

exports.popular = async (req, res, next) => {
  try {
    res.json({ items: await analyticsModel.popular(req.query.limit, scopeOf(req)) });
  } catch (err) { next(err); }
};

exports.categoryRevenue = async (req, res, next) => {
  try { res.json({ categories: await analyticsModel.categoryRevenue(scopeOf(req)) }); }
  catch (err) { next(err); }
};

exports.sales = async (req, res, next) => {
  try {
    res.json(analyticsModel.sales({
      from: req.query.from,
      to: req.query.to,
      ...scopeOf(req)
    }));
  } catch (err) { next(err); }
};
