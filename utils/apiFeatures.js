class APIFeatures {
  constructor(query, queryString) {
    this.query = query;
    this.queryString = queryString;
  }

  filter() {
    const queryObj = { ...this.queryString };
    // creating an array of all the fields we want to exclude
    const excludedFiles = ['page', 'sort', 'limit', 'field'];
    // removing all of these fields from our query object
    excludedFiles.forEach((el) => delete queryObj[el]);

    // advanced filtering
    // > converting the object to string
    let queryStr = JSON.stringify(queryObj);
    // > using the letter g in the end because the replacement should be done in all of the occurrences
    queryStr = queryStr.replace(/\b(gte|gt|lte|lt)\b/g, (match) => `$${match}`);
    // > gte, gt, lte, lt >>> abreviations for greater than or equals/greater than/less than or equals/less than

    this.query = this.query.find(JSON.parse(queryStr));

    // returning this funcionality so it can be called when executing
    return this;
  }

  sort() {
    if (this.queryString.sort) {
      const sortBy = this.queryString.sort.split(',').join(' ');
      this.query = this.query.sort(sortBy);
    } else {
      this.query = this.query.sort('-createdAt');
    }
    // returning this funcionality so it can be called when executing
    return this;
  }

  limitFields() {
    // field limiting ---- so the client cannot see all of them
    if (this.queryString.fields) {
      // including these fields in the response
      const fields = this.queryString.fields.split(',').join(' ');
      this.query = this.query.select(fields);
    } else {
      // excluding this field in the response
      this.query = this.query.select('-__v');
    }
    return this;
  }

  paginate() {
    // setting default values for pagination if the user doesnt request any
    const page = this.queryString.page * 1 || 1;
    const limit = this.queryString.limit * 1 || 100;
    const skip = (page - 1) * limit;
    // > if the user wants page number 2 with 10 results per page, it means he wants results from up to 11, meaning it should skip 10 results before we actually starts page 2
    this.query = this.query.skip(skip).limit(limit);

    return this;
  }
}

module.exports = APIFeatures