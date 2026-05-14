import { Link } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProductCard, ProductCardSkeleton } from "../components/ProductCard";
import {
  useFeaturedProducts,
  useNewArrivals,
  useRecommendations,
} from "../hooks/useProducts";
import { useAuth } from "../store";
import { AlignRight, ArrowRight } from "lucide-react";

const Home = () => {
  const { data: featured, isLoading: loadingFeatured } = useFeaturedProducts();
  const { data: newArrivals, isLoading: loadingNew } = useNewArrivals(8);
  const { user, isAuthenticated } = useAuth();
  const { data: recommendations, isLoading: loadingRecs } = useRecommendations(
    isAuthenticated && user?.id != null ? String(user.id) : null,
    4,
  );

  return (
    <main className="page-wrap px-4 pb-10 pt-12">
      <section className="island-shell relative overflow-hidden rounded-[2rem] py-10 sm:py-14">
        <p className="island-kicker mb-3">D4C Clothing Shop</p>
        <h1 className="display-title mb-5 max-w-3xl text-4xl font-bold tracking-tight text-(--sea-ink) sm:text-6xl">
          Bắt đầu từ danh mục, chạm đến từng chi tiết.
        </h1>
        <p className="mb-8 max-w-2xl text-base leading-8 text-(--sea-ink-soft) sm:text-lg">
          Trang chủ mới của D4C được thiết kế để bạn dễ dàng khám phá sản phẩm
          ngay.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button variant="default" size="lg">
            <Link to="/products">Xem tất cả sản phẩm</Link>
          </Button>
        </div>
      </section>

      {newArrivals && newArrivals.length > 0 && (
        <section className="mt-12">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold">Sản phẩm mới</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Những sản phẩm vừa được thêm vào cửa hàng
              </p>
            </div>
            <Button variant="link" asChild>
              <Link to="/products">
                Xem tất cả
                <ArrowRight className="inline-block ml-1" />
              </Link>
            </Button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {loadingNew
              ? Array.from({ length: 4 }).map((_, i) => (
                  <ProductCardSkeleton key={i} />
                ))
              : newArrivals
                  .slice(0, 4)
                  .map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
          </div>
        </section>
      )}

      {isAuthenticated && recommendations && recommendations.length > 0 && (
        <section className="mt-12">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold">Đề xuất cho bạn</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Dựa trên lịch sử duyệt và mua hàng của bạn
              </p>
            </div>
            <Button variant="link" asChild>
              <Link to="/recommendations">
                Xem tất cả
                <ArrowRight className="inline-block ml-1" />
              </Link>
            </Button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {loadingRecs
              ? Array.from({ length: 4 }).map((_, i) => (
                  <ProductCardSkeleton key={i} />
                ))
              : recommendations
                  .slice(0, 4)
                  .map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
          </div>
        </section>
      )}

      {featured && featured.length > 0 && (
        <section className="mt-12">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold">Sản phẩm nổi bật</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Những sản phẩm được yêu thích và đánh giá cao nhất từ khách hàng
              </p>
            </div>
            <Button variant="link" asChild>
              <Link to="/products">
                Xem tất cả
                <ArrowRight className="inline-block ml-1" />
              </Link>
            </Button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {loadingFeatured
              ? Array.from({ length: 4 }).map((_, i) => (
                  <ProductCardSkeleton key={i} />
                ))
              : featured
                  .slice(0, 4)
                  .map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
          </div>
        </section>
      )}

      <section className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {featureList.map(({ title, description }) => (
          <Card key={title} className="overflow-hidden">
            <CardHeader>
              <CardTitle className="text-base">{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-(--sea-ink-soft)">
              <Link to="/products" className="font-medium text-(--lagoon-deep)">
                Khám phá ngay <AlignRight className="inline-block ml-1" />
              </Link>
            </CardContent>
          </Card>
        ))}
      </section>
    </main>
  );
};

const featureList = [
  {
    title: "Bộ lọc nhanh",
    description: "Duyệt theo danh mục, giới tính, thương hiệu và khoảng giá.",
  },
  {
    title: "Mở chi tiết mượt",
    description: "Prefetch khi bạn hover hoặc focus vào sản phẩm.",
  },
  {
    title: "Trải nghiệm quen thuộc",
    description: "Giữ vibe thẩm mỹ gần với frontend cũ nhưng sạch hơn.",
  },
  {
    title: "Đi thẳng vào shop",
    description: "Trang chủ đóng vai trò cửa vào danh mục sản phẩm.",
  },
];

export default Home;
