import { productModel } from "../models/product.model.js";
import { categoryModel } from "../models/category.model.js";
import { variantModel } from "../models/variant.model.js";
import { dynamoClient } from "../config/aws.config.js";
import { ScanCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";
import dotenv from "dotenv";

dotenv.config();

const categories = ["Áo", "Quần", "Giày", "Phụ kiện"];
const genders = ["Nam", "Nữ", "Unisex"];
const brands = ["Nike", "Adidas", "Zara", "D4C", "H&M", "Uniqlo", "Local Brand"];
const colorsList = ["Đen", "Trắng", "Xám", "Đỏ", "Xanh Navy", "Xanh Dương", "Xanh Lá", "Vàng", "Hồng", "Nâu"];
const sizes = ["XS", "S", "M", "L", "XL", "XXL"];

const productTemplates = {
    "Áo": ["Áo Thun Basic", "Áo Polo Cao Cấp", "Áo Sơ Mi Công Sở", "Áo Khoác Gió", "Áo Hoodie Streetwear", "Áo Len Cardigan", "Áo Tanktop", "Áo Blazer"],
    "Quần": ["Quần Jean Slimfit", "Quần Tây Âu", "Quần Short Kaki", "Quần Jogger Thể Thao", "Quần Chino", "Quần Cargo", "Quần Legging"],
    "Giày": ["Giày Sneaker", "Giày Chạy Bộ", "Giày Tây Da Cừu", "Giày Slip-on", "Giày Sandal", "Giày Boot Da", "Giày Cao Gót"],
    "Phụ kiện": ["Thắt Lưng Da", "Mũ Lưỡi Trai", "Tất Cotton", "Ví Da", "Balo Chống Nước", "Kính Mát", "Túi Đeo Chéo"]
};

const testImages = [
    "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?q=80&w=800&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1542291026-7eec264c27ff?q=80&w=800&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?q=80&w=800&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?q=80&w=800&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1560343090-f0409e92791a?q=80&w=800&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?q=80&w=800&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1512436991641-6745cdb1723f?q=80&w=800&auto=format&fit=crop",
];

const clearTable = async (tableName) => {
    console.log(`🧹 Đang dọn dẹp bảng ${tableName}...`);
    try {
        let lastEvaluatedKey = undefined;
        let totalDeleted = 0;
        
        do {
            const scanCommand = new ScanCommand({ 
                TableName: tableName,
                ExclusiveStartKey: lastEvaluatedKey
            });
            const response = await dynamoClient.send(scanCommand);
            
            if (response.Items && response.Items.length > 0) {
                for (const item of response.Items) {
                    const deleteCommand = new DeleteCommand({
                        TableName: tableName,
                        Key: { id: item.id }
                    });
                    await dynamoClient.send(deleteCommand);
                    totalDeleted++;
                }
            }
            
            lastEvaluatedKey = response.LastEvaluatedKey;
        } while (lastEvaluatedKey);
        
        if (totalDeleted > 0) {
            console.log(`✅ Đã xóa ${totalDeleted} mục từ bảng ${tableName}.`);
        } else {
            console.log(`✅ Bảng ${tableName} đã trống.`);
        }
    } catch (e) {
        console.error(`❌ Lỗi khi dọn dẹp bảng ${tableName}:`, e.message);
    }
};

const seedProducts = async () => {
    console.log("🚀 Bắt đầu tạo dữ liệu mẫu...");

    await clearTable(process.env.VARIANT_TABLE_NAME || "d4c_variants");
    await clearTable(process.env.TABLE_NAME || "d4c_products");
    await clearTable(process.env.CATEGORY_TABLE_NAME || "d4c_categories");

    // 1. Create Categories

    // 1. Create Categories
    const categoryMap = {};
    for (const catName of categories) {
        const catId = uuidv4();
        await categoryModel.create({
            id: catId,
            name: catName,
            description: `Danh mục ${catName}`,
            imageUrl: "",
            createdAt: new Date().toISOString()
        });
        categoryMap[catName] = catId;
        console.log(`📁 Đã tạo danh mục: ${catName}`);
    }
    
    // 2. Create Products and Variants
    for (let i = 1; i <= 50; i++) {
        const categoryName = categories[Math.floor(Math.random() * categories.length)];
        const categoryId = categoryMap[categoryName];
        const template = productTemplates[categoryName];
        const baseName = template[Math.floor(Math.random() * template.length)];
        const gender = genders[Math.floor(Math.random() * genders.length)];
        const brand = brands[Math.floor(Math.random() * brands.length)];
        
        const productId = uuidv4();

        const productData = {
            id: productId,
            name: `${baseName} ${brand} - Mẫu ${i}`,
            description: `Đây là mô tả chi tiết cho sản phẩm ${baseName} từ thương hiệu ${brand}. Chất liệu cao cấp, phù hợp cho nhiều dịp.`,
            price: (Math.floor(Math.random() * 20) + 5) * 20000,
            categoryId: categoryId,
            gender: gender,
            brand: brand,
            imageUrl: testImages[Math.floor(Math.random() * testImages.length)],
            isFeatured: Math.random() > 0.8,
            tags: [categoryName.toLowerCase(), brand.toLowerCase(), gender.toLowerCase()],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        try {
            await productModel.create(productData);

            // Create Variants
            const numColors = Math.floor(Math.random() * 3) + 1;
            const colors = [];
            for(let j=0; j<numColors; j++) {
                const c = colorsList[Math.floor(Math.random() * colorsList.length)];
                if(!colors.includes(c)) colors.push(c);
            }

            for (const color of colors) {
                // Randomly select 2-4 sizes for this color
                const numSizes = Math.floor(Math.random() * 3) + 2;
                const shuffledSizes = sizes.sort(() => 0.5 - Math.random()).slice(0, numSizes);
                
                for (const size of shuffledSizes) {
                    await variantModel.create({
                        id: uuidv4(),
                        productId: productId,
                        color: color,
                        size: size,
                        quantity: Math.floor(Math.random() * 50),
                        sku: `${productId}-${color}-${size}`.replace(/\s/g, "-")
                    });
                }
            }
            console.log(`✅ Đã thêm: ${productData.name} và các biến thể`);
        } catch (error) {
            console.error(`❌ Lỗi khi thêm sp ${i}:`, error.message);
        }
    }

    console.log("✨ Hoàn thành! Đã thêm 50 sản phẩm mẫu cùng biến thể.");
    process.exit();
};

seedProducts();
