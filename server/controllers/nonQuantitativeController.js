const nonQuantitativeServices = require("../services/nonQuantitativeServices");
exports.check = async (req, res, next) => {
  try {
    console.log(req.body);
    // const getcols = req.body;
    const result = await nonQuantitativeServices.SelectedCode(
      req.body.filename,
      req.body.attributes
    );
    //  console.log(result)
    res.status(200).json(result);
  } catch (err) {
    console.log(err);
    next(err);
  }
};
exports.insertData = async (req, res, next) => {
  try {
    console.log(req.body);
    // const getcols = req.body;
    const result = await stationService.createLog(req.body);
    //  console.log(result)
    res.status(200).json(result);
  } catch (err) {
    console.log(err);
    next(err);
  }
};
exports.getLogs = async (req, res, next) => {
  try {
    // console.log(req.body)
    // const getcols = req.body;
    const result = await stationService.getlogs();
    //  console.log(result)
    res.status(200).json(result);
  } catch (err) {
    console.log(err);
    next(err);
  }
};
exports.viewFile = async (req, res, next) => {
  try {
    // console.log(req.body)
    // const getcols = req.body;
    const result = await stationService.viewFile(req.body);
    //  console.log(result)
    res.status(200).json(result);
  } catch (err) {
    console.log(err);
    next(err);
  }
};

// ****************************************************************************************************

exports.codecheck = async (req, res, next) => {
  try {
    console.log(req.body);
    // const getcols = req.body;
    const result = await nonQuantitativeServices.SelectedCodeAndName(
      req.body.filename,
      req.body.attributes
    );
    //  console.log(result)
    res.status(200).json(result);
  } catch (err) {
    console.log(err);
    next(err);
  }
};
