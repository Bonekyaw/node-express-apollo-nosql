/*
 * Pagination
 * There are two methods: offset-based and cursor-based paginations.
 * This is offset-based pagination.
 */
const { GraphQLError } = require("graphql");

exports.offset = async (
  model,
  page = 1,
  limit = 10,
  filters,
  sort,
  lookup_1
) => {
  const offset = (page - 1) * limit;

  let options = [];
  if (sort) {
    options = [...options, { $sort: sort }];
  }
  options = [...options, { $skip: offset }, { $limit: limit }];

  if (lookup_1) {
    options = [...options, { $lookup: lookup_1 }];
  }

  let totalCount = [{ $count: "count" }];
  if (filters) {
    totalCount = [{ $match: filters }, ...totalCount];
  }

  let aggregatePipeline = [];
  if (filters) {
    aggregatePipeline = [...aggregatePipeline, { $match: filters }];
  }

  aggregatePipeline = [
    ...aggregatePipeline,
    { $facet: { data: options, totalCount: totalCount } },
  ];

  try {
    const results = await model.aggregate(aggregatePipeline);
    const collections = results[0]?.data || [];
    const count = results[0]?.totalCount[0]?.count || 0;

    return {
      total: count,
      data: collections,
      pageInfo: {
        currentPage: page,
        previousPage: page == 1 ? null : page - 1,
        nextPage: page * limit >= count ? null : page + 1,
        lastPage: Math.ceil(count / limit),
        countPerPage: limit,
      },
    };
  } catch (error) {
    throw new GraphQLError("Server Error", {
      extensions: {
        code: "SERVER_ERROR",
        http: { status: 500 },
      },
    });
  }
};

exports.noCount = async (
  model,
  page = 1,
  limit = 10,
  filters,
  sort,
  populate
) => {
  const offset = (page - 1) * limit;

  // collections = await model
  //   .find(filters, fields, { skip: offset, limit: limit })
  //   .exec();
  try {
    const collections = populate
      ? await model
          .find(filters)
          .sort(sort)
          .skip(offset)
          .limit(limit + 1)
          .populate(populate)
      : await model
          .find(filters)
          .sort(sort)
          .skip(offset)
          .limit(limit + 1);
    let hasNextPage = false;
    if (collections.length > limit) {
      // if got an extra result
      hasNextPage = true; // has a next page of results
      collections.pop(); // remove extra result
    }

    return {
      data: collections,
      pageInfo: {
        currentPage: page,
        previousPage: page == 1 ? null : page - 1,
        nextPage: hasNextPage ? page + 1 : null,
        countPerPage: limit,
      },
    };
  } catch (error) {
    throw new GraphQLError("Server Error", {
      extensions: {
        code: "SERVER_ERROR",
        http: { status: 500 },
      },
    });
  }
};
/*
 * Pagination
 * There are two methods: offset-based and cursor-based paginations.
 * This is cursor-based pagination.
 */
exports.cursor = async (
  model,
  cursor,
  limit = 10,
  filters,
  sort = "-createdAt",
  populate
) => {
  const cursorR = cursor || null;
  // const query = cursor
  //   ? { createdAt: { $lt: new Date(cursor) } } // Fetch admins created before the cursor
  //   : {};

  let filter = {};
  // Add cursor-based filter
  if (cursorR) {
    filter._id = { $lt: cursorR };
  }

  if (filters) {
    filter = { ...filter, ...filters };
  }

  try {
    const collections = populate
      ? await model
          .find(filter)
          .sort(sort) // Sort by createdAt in descending order
          .limit(limit + 1)
          .populate(populate)
      : await model
          .find(filter)
          .sort(sort) // Sort by createdAt in descending order
          .limit(limit + 1); // Fetch one extra document to check if there's a next page
    const hasNextPage = collections.length > limit;
    if (hasNextPage) {
      collections.pop(); // Remove the extra document if it exists
    }

    return {
      data: collections,
      pageInfo: {
        nextCursor: hasNextPage
          ? collections[collections.length - 1]._id
          : null,
        hasNextPage,
      },
    };
  } catch (error) {
    throw new GraphQLError("Server Error", {
      extensions: {
        code: "SERVER_ERROR",
        http: { status: 500 },
      },
    });
  }
};