import { productModel } from "../models/product.model.js";
import { v4 as uuidv4 } from "uuid";

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

// Placeholder images for testing (Fashion related)
const testImages = [
    "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?q=80&w=800&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1542291026-7eec264c27ff?q=80&w=800&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?q=80&w=800&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?q=80&w=800&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1560343090-f0409e92791a?q=80&w=800&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?q=80&w=800&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1512436991641-6745cdb1723f?q=80&w=800&auto=format&fit=crop",
];

const seedProducts = async () => {
    console.log("🚀 Bắt đầu tạo 50 sản phẩm mẫu...");
    
    for (let i = 1; i <= 50; i++) {
        const category = categories[Math.floor(Math.random() * categories.length)];
        const template = productTemplates[category];
        const baseName = template[Math.floor(Math.random() * template.length)];
        const gender = genders[Math.floor(Math.random() * genders.length)];
        const brand = brands[Math.floor(Math.random() * brands.length)];
        
        // Random colors (1-3 colors per product)
        const numColors = Math.floor(Math.random() * 3) + 1;
        const colors = [];
        for(let j=0; j<numColors; j++) {
            const c = colorsList[Math.floor(Math.random() * colorsList.length)];
            if(!colors.includes(c)) colors.push(c);
        }

        // Random stock for each size
        const stock = sizes.map(size => ({
            size,
            quantity: Math.floor(Math.random() * 50)
        }));

        const productData = {
            id: uuidv4(),
            name: `${baseName} ${brand} - Mẫu ${i}`,
            description: `Đây là mô tả chi tiết cho sản phẩm ${baseName} từ thương hiệu ${brand}. Chất liệu cao cấp, phù hợp cho nhiều dịp.`,
            price: (Math.floor(Math.random() * 20) + 5) * 20000, // Giá từ 100k đến 500k
            category: category,
            gender: gender,
            brand: brand,
            colors: colors,
            stock: stock,
            imageUrl: testImages[Math.floor(Math.random() * testImages.length)],
            isFeatured: Math.random() > 0.8, // 20% sp nổi bật
            tags: [category.toLowerCase(), brand.toLowerCase(), gender.toLowerCase()],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        try {
            await productModel.create(productData);
            console.log(`✅ Đã thêm: ${productData.name}`);
        } catch (error) {
            console.error(`❌ Lỗi khi thêm sp ${i}:`, error.message);
        }
    }

    console.log("✨ Hoàn thành! Đã thêm 50 sản phẩm mẫu.");
    process.exit();
};

seedProducts();
