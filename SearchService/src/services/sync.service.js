import typesenseClient from "../config/typesense.config.js";

const COLLECTION_NAME = "d4c_products";

const COLLECTION_SCHEMA = {
  name: COLLECTION_NAME,
  enable_nested_fields: true,
  fields: [
    { name: "id", type: "string" },
    { name: "name", type: "string" },
    { name: "description", type: "string", optional: true },
    { name: "category", type: "string", facet: true, optional: true },
    { name: "brand", type: "string", facet: true, optional: true },
    { name: "name_norm", type: "string", optional: true },
    { name: "description_norm", type: "string", optional: true },
    { name: "category_norm", type: "string", facet: true, optional: true },
    { name: "brand_norm", type: "string", facet: true, optional: true },
    { name: "tags_norm", type: "string[]", optional: true },
    { name: "gender", type: "string", facet: true, optional: true },
    { name: "price", type: "float", facet: true },
    { name: "tags", type: "string[]", optional: true },
    { name: "sizes", type: "string[]", facet: true, optional: true },
    { name: "colors", type: "string[]", facet: true, optional: true },
    { name: "imageUrl", type: "string", index: false, optional: true },
    { name: "isFeatured", type: "bool", optional: true },
    { name: "createdAt", type: "int64" },
    { name: "variants", type: "object[]", index: false, optional: true },
    {
      name: "embedding",
      type: "float[]",
      embed: {
        from: ["name", "description"],
        model_config: {
          model_name: "ts/all-MiniLM-L12-v2",
        },
      },
    },
  ],
};

export async function ensureCollection() {
  const maxRetries = 10;
  const retryDelay = 3000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const collections = await typesenseClient.collections().retrieve();
      const exists = collections.find((c) => c.name === COLLECTION_NAME);

      if (exists) {
        // Drop existing collection to recreate with correct schema (enable_nested_fields)
        console.log(`Dropping existing collection "${COLLECTION_NAME}" to recreate with correct schema...`);
        await typesenseClient.collections(COLLECTION_NAME).delete();
      }

      const collection = await typesenseClient.collections().create(COLLECTION_SCHEMA);
      console.log(`Typesense collection "${COLLECTION_NAME}" created`);
      return collection;
    } catch (err) {
      if (err.httpStatus === 503 && attempt < maxRetries) {
        console.log(`Typesense not ready (attempt ${attempt}/${maxRetries}), retrying in ${retryDelay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
        continue;
      }
      if (err.httpStatus === 409 && attempt < maxRetries) {
        // Race condition: another instance created it between retrieve and create
        console.log(`Collection already exists (race condition), retrying...`);
        await new Promise((resolve) => setTimeout(resolve, 1000));
        continue;
      }
      throw err;
    }
  }
}

export async function upsertDocs(docs) {
  const results = await typesenseClient
    .collections(COLLECTION_NAME)
    .documents()
    .import(docs, { action: "upsert" });

  const failed = results.filter((r) => !r.success);
  if (failed.length > 0) {
    console.error(`Typesense import failed: ${failed.length}/${results.length}`, failed);
  }

  return results;
}

export async function upsertDoc(doc) {
  return await typesenseClient
    .collections(COLLECTION_NAME)
    .documents()
    .upsert(doc);
}

export async function deleteDoc(id) {
  try {
    return await typesenseClient
      .collections(COLLECTION_NAME)
      .documents(id)
      .delete();
  } catch (err) {
    if (err.httpStatus === 404) {
      console.log(`Document ${id} not found in Typesense, skipping delete`);
      return null;
    }
    throw err;
  }
}

const CATEGORY_COLLECTION_NAME = "d4c_categories";

const CATEGORY_COLLECTION_SCHEMA = {
  name: CATEGORY_COLLECTION_NAME,
  fields: [
    { name: "id", type: "string" },
    { name: "name", type: "string", locale: "vi", facet: true },
    { name: "description", type: "string", locale: "vi", optional: true },
    { name: "imageUrl", type: "string", index: false, optional: true },
    { name: "createdAt", type: "int64" },
    { name: "updatedAt", type: "int64" },
  ],
  default_sorting_field: "createdAt",
};

export async function ensureCategoryCollection() {
  const maxRetries = 10;
  const retryDelay = 3000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const collections = await typesenseClient.collections().retrieve();
      const exists = collections.find((c) => c.name === CATEGORY_COLLECTION_NAME);

      if (exists) {
        console.log(`Dropping existing collection "${CATEGORY_COLLECTION_NAME}" to recreate...`);
        await typesenseClient.collections(CATEGORY_COLLECTION_NAME).delete();
      }

      const collection = await typesenseClient.collections().create(CATEGORY_COLLECTION_SCHEMA);
      console.log(`Typesense collection "${CATEGORY_COLLECTION_NAME}" created`);
      return collection;
    } catch (err) {
      if (err.httpStatus === 503 && attempt < maxRetries) {
        console.log(`Typesense not ready for categories (attempt ${attempt}/${maxRetries}), retrying in ${retryDelay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
        continue;
      }
      if (err.httpStatus === 409 && attempt < maxRetries) {
        console.log(`Category collection already exists (race condition), retrying...`);
        await new Promise((resolve) => setTimeout(resolve, 1000));
        continue;
      }
      throw err;
    }
  }
}

export async function upsertCategoryDoc(doc) {
  return await typesenseClient
    .collections(CATEGORY_COLLECTION_NAME)
    .documents()
    .upsert(doc);
}

export async function deleteCategoryDoc(id) {
  try {
    return await typesenseClient
      .collections(CATEGORY_COLLECTION_NAME)
      .documents(id)
      .delete();
  } catch (err) {
    if (err.httpStatus === 404) {
      console.log(`Category document ${id} not found in Typesense, skipping delete`);
      return null;
    }
    throw err;
  }
}
