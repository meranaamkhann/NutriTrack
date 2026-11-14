// Starter food database. Values are typical reference figures per the stated
// serving (rounded, not lab-measured), so treat them as good estimates. The
// serving unit is what the numbers are for: "100 G" means per 100 g.
export interface SeedFood {
  name: string;
  servingSize: number;
  servingUnit: "G" | "ML" | "PIECE" | "CUP" | "TBSP" | "TSP" | "OZ";
  calories: number;
  proteinG: number;
  carbG: number;
  fatG: number;
  fiberG?: number;
}

const f = (
  name: string,
  servingSize: number,
  servingUnit: SeedFood["servingUnit"],
  calories: number,
  proteinG: number,
  carbG: number,
  fatG: number,
  fiberG?: number
): SeedFood => ({ name, servingSize, servingUnit, calories, proteinG, carbG, fatG, fiberG });

export const SEED_FOODS: SeedFood[] = [
  // Eggs & dairy
  f("Egg, whole, boiled", 1, "PIECE", 78, 6.3, 0.6, 5.3, 0),
  f("Egg white", 1, "PIECE", 17, 3.6, 0.2, 0.1, 0),
  f("Milk, whole", 1, "CUP", 149, 7.7, 11.7, 7.9, 0),
  f("Milk, skimmed", 1, "CUP", 83, 8.3, 12.2, 0.2, 0),
  f("Curd / plain yogurt, whole milk", 1, "CUP", 149, 8.5, 11.4, 8, 0),
  f("Greek yogurt, plain, non-fat", 100, "G", 59, 10.2, 3.6, 0.4, 0),
  f("Paneer", 100, "G", 265, 18.3, 1.2, 20.8, 0),
  f("Cottage cheese", 100, "G", 98, 11.1, 3.4, 4.3, 0),
  f("Cheddar cheese", 100, "G", 403, 24.9, 1.3, 33.1, 0),
  f("Soy milk, unsweetened", 1, "CUP", 80, 7, 4, 4, 1),
  f("Almond milk, unsweetened", 1, "CUP", 30, 1, 1, 2.5, 0),
  // Meat, fish, plant protein
  f("Chicken breast, cooked, skinless", 100, "G", 165, 31, 0, 3.6, 0),
  f("Salmon, cooked", 100, "G", 206, 22.1, 0, 12.4, 0),
  f("Tuna, canned in water", 100, "G", 116, 25.5, 0, 0.8, 0),
  f("Shrimp, cooked", 100, "G", 99, 24, 0.2, 0.3, 0),
  f("Tofu, firm", 100, "G", 144, 17.3, 2.8, 8.7, 2.3),
  f("Whey protein powder", 30, "G", 120, 24, 3, 1.5, 0),
  // Grains & breads
  f("Rice, white, cooked", 100, "G", 130, 2.7, 28.2, 0.3, 0.4),
  f("Rice, brown, cooked", 100, "G", 123, 2.7, 25.6, 1, 1.6),
  f("Roti / chapati, whole wheat", 1, "PIECE", 120, 3.1, 18, 3.7, 3),
  f("Paratha, plain", 1, "PIECE", 260, 5, 36, 10, 3),
  f("Bread, whole wheat", 1, "PIECE", 69, 3.6, 11.6, 0.9, 1.9),
  f("Bread, white", 1, "PIECE", 67, 1.9, 12.7, 0.8, 0.6),
  f("Oats, rolled, dry", 100, "G", 379, 13.2, 67.7, 6.5, 10.1),
  f("Pasta, cooked", 100, "G", 158, 5.8, 30.9, 0.9, 1.8),
  f("Quinoa, cooked", 100, "G", 120, 4.4, 21.3, 1.9, 2.8),
  f("Cornflakes", 100, "G", 357, 7, 84, 0.4, 3.3),
  f("Idli", 1, "PIECE", 58, 2, 12, 0.4, 0.8),
  f("Dosa, plain", 1, "PIECE", 133, 2.7, 25.6, 2.1, 1),
  // Legumes
  f("Dal (lentils), cooked", 100, "G", 116, 9, 20.1, 0.4, 7.9),
  f("Moong dal, cooked", 100, "G", 105, 7, 19.2, 0.4, 7.6),
  f("Chickpeas, cooked", 100, "G", 164, 8.9, 27.4, 2.6, 7.6),
  f("Rajma (kidney beans), cooked", 100, "G", 127, 8.7, 22.8, 0.5, 6.4),
  // Vegetables
  f("Potato, boiled", 100, "G", 87, 1.9, 20.1, 0.1, 1.8),
  f("Sweet potato, baked", 100, "G", 90, 2, 20.7, 0.2, 3.3),
  f("Broccoli, cooked", 100, "G", 35, 2.4, 7.2, 0.4, 3.3),
  f("Spinach, raw", 100, "G", 23, 2.9, 3.6, 0.4, 2.2),
  f("Carrot, raw", 100, "G", 41, 0.9, 9.6, 0.2, 2.8),
  f("Tomato, raw", 100, "G", 18, 0.9, 3.9, 0.2, 1.2),
  f("Onion, raw", 100, "G", 40, 1.1, 9.3, 0.1, 1.7),
  f("Cucumber, raw", 100, "G", 15, 0.7, 3.6, 0.1, 0.5),
  f("Avocado", 100, "G", 160, 2, 8.5, 14.7, 6.7),
  // Fruit
  f("Banana", 1, "PIECE", 105, 1.3, 27, 0.4, 3.1),
  f("Apple", 1, "PIECE", 95, 0.5, 25, 0.3, 4.4),
  f("Orange", 1, "PIECE", 62, 1.2, 15.4, 0.2, 3.1),
  f("Mango", 100, "G", 60, 0.8, 15, 0.4, 1.6),
  f("Grapes", 100, "G", 69, 0.7, 18.1, 0.2, 0.9),
  f("Papaya", 100, "G", 43, 0.5, 10.8, 0.3, 1.7),
  f("Watermelon", 100, "G", 30, 0.6, 7.6, 0.2, 0.4),
  // Nuts, fats, sweeteners
  f("Almonds", 100, "G", 579, 21.2, 21.6, 49.9, 12.5),
  f("Peanuts", 100, "G", 567, 25.8, 16.1, 49.2, 8.5),
  f("Walnuts", 100, "G", 654, 15.2, 13.7, 65.2, 6.7),
  f("Peanut butter", 1, "TBSP", 94, 3.6, 3.2, 8, 0.9),
  f("Olive oil", 1, "TBSP", 119, 0, 0, 13.5, 0),
  f("Butter", 1, "TBSP", 102, 0.1, 0, 11.5, 0),
  f("Ghee", 1, "TBSP", 117, 0, 0, 13, 0),
  f("Sugar", 1, "TSP", 16, 0, 4.2, 0, 0),
  f("Honey", 1, "TBSP", 64, 0.1, 17.3, 0, 0),
  f("Dark chocolate (70-85%)", 100, "G", 598, 7.8, 45.9, 42.6, 10.9),
  // Drinks
  f("Coffee, black", 1, "CUP", 2, 0.3, 0, 0, 0),
  f("Chai (milk tea with sugar)", 150, "ML", 70, 2, 10, 2, 0),
  f("Orange juice", 1, "CUP", 112, 1.7, 25.8, 0.5, 0.5),
  f("Cola", 330, "ML", 139, 0, 35, 0, 0),
  // Common prepared foods
  f("Samosa", 1, "PIECE", 262, 3.5, 24, 17, 2),
  f("Pizza, cheese, slice", 1, "PIECE", 285, 12.2, 35.7, 10.4, 2.5),
  f("French fries", 100, "G", 312, 3.4, 41, 14.7, 3.8)
];
