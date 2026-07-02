import { getDatabase } from '@/db/offlineDb';

export type OfflineMealItem = {
  id: string;
  foodName: string;
  calories: number;
  proteinG?: number | null;
  carbsG?: number | null;
  fatG?: number | null;
};

export type OfflineMealLog = {
  clientMealId: string;
  userKey: string;
  dayKey: string;
  mealType: 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK';
  inputText?: string | null;
  hadImage?: boolean;
  totalCalories: number;
  totalProteinG?: number | null;
  totalCarbsG?: number | null;
  totalFatG?: number | null;
  loggedAt: string;
  synced: boolean;
  serverMealId?: string | null;
  createdAt: string;
  updatedAt: string;
  items: OfflineMealItem[];
};

let tablesReady = false;

async function ensureMealTables(): Promise<void> {
  if (tablesReady) return;
  const db = await getDatabase();
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS meal_logs_local (
      clientMealId TEXT PRIMARY KEY,
      userKey TEXT NOT NULL,
      dayKey TEXT NOT NULL,
      mealType TEXT NOT NULL,
      inputText TEXT,
      hadImage INTEGER DEFAULT 0,
      totalCalories INTEGER NOT NULL DEFAULT 0,
      totalProteinG REAL,
      totalCarbsG REAL,
      totalFatG REAL,
      loggedAt TEXT NOT NULL,
      synced INTEGER DEFAULT 0,
      serverMealId TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_meal_logs_local_user_day ON meal_logs_local(userKey, dayKey);
    CREATE INDEX IF NOT EXISTS idx_meal_logs_local_synced ON meal_logs_local(synced);

    CREATE TABLE IF NOT EXISTS meal_items_local (
      id TEXT PRIMARY KEY,
      clientMealId TEXT NOT NULL,
      foodName TEXT NOT NULL,
      calories INTEGER NOT NULL,
      proteinG REAL,
      carbsG REAL,
      fatG REAL,
      createdAt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_meal_items_local_meal ON meal_items_local(clientMealId);
  `);
  tablesReady = true;
}

async function upsertMealInternal(meal: OfflineMealLog): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT OR REPLACE INTO meal_logs_local
      (clientMealId, userKey, dayKey, mealType, inputText, hadImage, totalCalories, totalProteinG, totalCarbsG, totalFatG, loggedAt, synced, serverMealId, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    meal.clientMealId,
    meal.userKey,
    meal.dayKey,
    meal.mealType,
    meal.inputText ?? null,
    meal.hadImage ? 1 : 0,
    meal.totalCalories,
    meal.totalProteinG ?? null,
    meal.totalCarbsG ?? null,
    meal.totalFatG ?? null,
    meal.loggedAt,
    meal.synced ? 1 : 0,
    meal.serverMealId ?? null,
    meal.createdAt,
    meal.updatedAt
  );

  await db.runAsync(`DELETE FROM meal_items_local WHERE clientMealId = ?`, meal.clientMealId);
  for (const item of meal.items) {
    await db.runAsync(
      `INSERT OR REPLACE INTO meal_items_local
        (id, clientMealId, foodName, calories, proteinG, carbsG, fatG, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      item.id,
      meal.clientMealId,
      item.foodName,
      item.calories,
      item.proteinG ?? null,
      item.carbsG ?? null,
      item.fatG ?? null,
      meal.createdAt
    );
  }
}

export async function upsertLocalMeal(meal: OfflineMealLog): Promise<void> {
  await ensureMealTables();
  await upsertMealInternal(meal);
}

function mapRowsToMeals(
  mealRows: Array<{
    clientMealId: string;
    userKey: string;
    dayKey: string;
    mealType: string;
    inputText: string | null;
    hadImage: number;
    totalCalories: number;
    totalProteinG: number | null;
    totalCarbsG: number | null;
    totalFatG: number | null;
    loggedAt: string;
    synced: number;
    serverMealId: string | null;
    createdAt: string;
    updatedAt: string;
  }>,
  itemRows: Array<{
    id: string;
    clientMealId: string;
    foodName: string;
    calories: number;
    proteinG: number | null;
    carbsG: number | null;
    fatG: number | null;
  }>
): OfflineMealLog[] {
  const itemsByMeal = new Map<string, OfflineMealItem[]>();
  for (const row of itemRows) {
    if (!itemsByMeal.has(row.clientMealId)) itemsByMeal.set(row.clientMealId, []);
    itemsByMeal.get(row.clientMealId)!.push({
      id: row.id,
      foodName: row.foodName,
      calories: row.calories,
      proteinG: row.proteinG,
      carbsG: row.carbsG,
      fatG: row.fatG,
    });
  }

  return mealRows.map((m) => ({
    clientMealId: m.clientMealId,
    userKey: m.userKey,
    dayKey: m.dayKey,
    mealType: m.mealType as OfflineMealLog['mealType'],
    inputText: m.inputText,
    hadImage: m.hadImage === 1,
    totalCalories: m.totalCalories,
    totalProteinG: m.totalProteinG,
    totalCarbsG: m.totalCarbsG,
    totalFatG: m.totalFatG,
    loggedAt: m.loggedAt,
    synced: m.synced === 1,
    serverMealId: m.serverMealId,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
    items: itemsByMeal.get(m.clientMealId) ?? [],
  }));
}

export async function getLocalMealsForDay(userKey: string, dayKey: string): Promise<OfflineMealLog[]> {
  await ensureMealTables();
  const db = await getDatabase();
  const mealRows = await db.getAllAsync<{
    clientMealId: string;
    userKey: string;
    dayKey: string;
    mealType: string;
    inputText: string | null;
    hadImage: number;
    totalCalories: number;
    totalProteinG: number | null;
    totalCarbsG: number | null;
    totalFatG: number | null;
    loggedAt: string;
    synced: number;
    serverMealId: string | null;
    createdAt: string;
    updatedAt: string;
  }>(
    `SELECT * FROM meal_logs_local
     WHERE userKey = ? AND dayKey = ?
     ORDER BY loggedAt ASC`,
    userKey,
    dayKey
  );
  if (mealRows.length === 0) return [];

  const placeholders = mealRows.map(() => '?').join(',');
  const itemRows = await db.getAllAsync<{
    id: string;
    clientMealId: string;
    foodName: string;
    calories: number;
    proteinG: number | null;
    carbsG: number | null;
    fatG: number | null;
  }>(
    `SELECT id, clientMealId, foodName, calories, proteinG, carbsG, fatG
     FROM meal_items_local
     WHERE clientMealId IN (${placeholders})`,
    ...mealRows.map((m) => m.clientMealId)
  );

  return mapRowsToMeals(mealRows, itemRows);
}

export async function getPendingLocalMeals(userKey: string): Promise<OfflineMealLog[]> {
  await ensureMealTables();
  const db = await getDatabase();
  const mealRows = await db.getAllAsync<{
    clientMealId: string;
    userKey: string;
    dayKey: string;
    mealType: string;
    inputText: string | null;
    hadImage: number;
    totalCalories: number;
    totalProteinG: number | null;
    totalCarbsG: number | null;
    totalFatG: number | null;
    loggedAt: string;
    synced: number;
    serverMealId: string | null;
    createdAt: string;
    updatedAt: string;
  }>(
    `SELECT * FROM meal_logs_local
     WHERE userKey = ? AND synced = 0
     ORDER BY createdAt ASC`,
    userKey
  );
  if (mealRows.length === 0) return [];

  const placeholders = mealRows.map(() => '?').join(',');
  const itemRows = await db.getAllAsync<{
    id: string;
    clientMealId: string;
    foodName: string;
    calories: number;
    proteinG: number | null;
    carbsG: number | null;
    fatG: number | null;
  }>(
    `SELECT id, clientMealId, foodName, calories, proteinG, carbsG, fatG
     FROM meal_items_local
     WHERE clientMealId IN (${placeholders})`,
    ...mealRows.map((m) => m.clientMealId)
  );

  return mapRowsToMeals(mealRows, itemRows);
}

export async function markLocalMealSynced(userKey: string, clientMealId: string, serverMealId?: string): Promise<void> {
  await ensureMealTables();
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE meal_logs_local
     SET synced = 1, serverMealId = COALESCE(?, serverMealId), updatedAt = ?
     WHERE userKey = ? AND clientMealId = ?`,
    serverMealId ?? null,
    new Date().toISOString(),
    userKey,
    clientMealId
  );
}

export async function replaceSyncedLocalMealsForDay(
  userKey: string,
  dayKey: string,
  meals: OfflineMealLog[]
): Promise<void> {
  await ensureMealTables();
  const db = await getDatabase();

  await db.runAsync(
    `DELETE FROM meal_items_local
     WHERE clientMealId IN (
       SELECT clientMealId FROM meal_logs_local WHERE userKey = ? AND dayKey = ? AND synced = 1
     )`,
    userKey,
    dayKey
  );
  await db.runAsync(
    `DELETE FROM meal_logs_local
     WHERE userKey = ? AND dayKey = ? AND synced = 1`,
    userKey,
    dayKey
  );

  for (const meal of meals) {
    await upsertMealInternal({ ...meal, userKey, dayKey, synced: true });
  }
}

export async function deleteLocalMealItem(
  userKey: string,
  mealIdOrClientMealId: string,
  itemId: string
): Promise<boolean> {
  await ensureMealTables();
  const db = await getDatabase();

  const mealRow = await db.getFirstAsync<{
    clientMealId: string;
    userKey: string;
    totalCalories: number;
    totalProteinG: number | null;
    totalCarbsG: number | null;
    totalFatG: number | null;
  }>(
    `SELECT clientMealId, userKey, totalCalories, totalProteinG, totalCarbsG, totalFatG
     FROM meal_logs_local
     WHERE userKey = ? AND (clientMealId = ? OR serverMealId = ?)
     LIMIT 1`,
    userKey,
    mealIdOrClientMealId,
    mealIdOrClientMealId
  );

  if (!mealRow) return false;

  const itemExists = await db.getFirstAsync<{ id: string }>(
    `SELECT id FROM meal_items_local WHERE id = ? AND clientMealId = ? LIMIT 1`,
    itemId,
    mealRow.clientMealId
  );
  if (!itemExists) return false;

  await db.runAsync(
    `DELETE FROM meal_items_local WHERE id = ? AND clientMealId = ?`,
    itemId,
    mealRow.clientMealId
  );

  const remaining = await db.getAllAsync<{
    calories: number;
    proteinG: number | null;
    carbsG: number | null;
    fatG: number | null;
  }>(
    `SELECT calories, proteinG, carbsG, fatG FROM meal_items_local WHERE clientMealId = ?`,
    mealRow.clientMealId
  );

  if (remaining.length === 0) {
    await db.runAsync(`DELETE FROM meal_logs_local WHERE clientMealId = ? AND userKey = ?`, mealRow.clientMealId, userKey);
    return true;
  }

  const totals = remaining.reduce(
    (acc, row) => {
      acc.calories += Number(row.calories) || 0;
      acc.protein += Number(row.proteinG) || 0;
      acc.carbs += Number(row.carbsG) || 0;
      acc.fat += Number(row.fatG) || 0;
      return acc;
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  await db.runAsync(
    `UPDATE meal_logs_local
     SET totalCalories = ?, totalProteinG = ?, totalCarbsG = ?, totalFatG = ?, updatedAt = ?
     WHERE clientMealId = ? AND userKey = ?`,
    totals.calories,
    totals.protein || null,
    totals.carbs || null,
    totals.fat || null,
    new Date().toISOString(),
    mealRow.clientMealId,
    userKey
  );

  return true;
}
