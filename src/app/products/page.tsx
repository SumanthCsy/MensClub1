// @/app/products/page.tsx
"use client";

import { Suspense, useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { ProductCard } from '@/components/products/product-card';
import type { Product } from '@/types';
import { collection, getDocs, query, orderBy, where, limit, onSnapshot, QueryConstraint, Unsubscribe } from "firebase/firestore";
import { db } from '@/lib/firebase';
import { ProductFilters } from '@/components/products/product-filters';
import { Separator } from '@/components/ui/separator';
import { PackageSearch, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

const productCategories = [
  "New Arrivals",
  "Formals & Casuals",
  "Trendy",
  "Jeans",
  "T-shirts",
  "Others",
  "Limited Time Offers"
];

function ProductsPageContent() {
  const searchParams = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const currentCategory = useMemo(() => searchParams.get('category') || "All Categories", [searchParams]);
  const currentSortBy = useMemo(() => searchParams.get('sortBy') || "featured", [searchParams]);

  useEffect(() => {
    setIsLoading(true);
    setError(null);

    const productsCol = collection(db, "products");
    const constraints: QueryConstraint[] = [];

    if (currentCategory && currentCategory !== "All Categories") {
      constraints.push(where("category", "==", currentCategory));
    }

    let sortField = "name";
    let sortDirection: "asc" | "desc" = "asc";

    if (currentSortBy === "newest") {
      sortField = "name";
      sortDirection = "desc";
    } else if (currentSortBy === "price-asc") {
      sortField = "price";
      sortDirection = "asc";
    } else if (currentSortBy === "price-desc") {
      sortField = "price";
      sortDirection = "desc";
    }
    
    constraints.push(orderBy(sortField, sortDirection));

    const q = query(productsCol, ...constraints);

    const unsubscribe: Unsubscribe = onSnapshot(q, (querySnapshot) => {
      const productList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Product));
      setProducts(productList);
      setIsLoading(false);
    }, (err) => {
      console.error("Error fetching products with onSnapshot:", err);
      setError("Failed to load products in real-time. Please ensure Firestore indexes are set up if prompted.");
      setIsLoading(false);
    });

    return () => unsubscribe();

  }, [currentCategory, currentSortBy]);

  return (
    <div className="container mx-auto max-w-screen-xl px-4 sm:px-6 lg:px-8 py-12 md:py-16">
      <div className="mb-10 text-center">
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-foreground">
          {currentCategory === "All Categories" ? "Our Collection" : currentCategory}
        </h1>
        <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
          Discover meticulously crafted pieces designed for the modern man. Updates in real-time!
        </p>
      </div>

      <ProductFilters categories={["All Categories", ...productCategories]} />
      
      <Separator className="my-8" />

      {isLoading && (
        <div className="text-center py-16">
          <Loader2 className="mx-auto h-12 w-12 text-primary animate-spin mb-4" />
          <p className="text-lg text-muted-foreground">Loading products...</p>
        </div>
      )}

      {!isLoading && error && (
        <div className="text-center py-16">
          <AlertTriangle className="mx-auto h-12 w-12 text-destructive mb-4" />
          <p className="text-lg text-destructive">{error}</p>
          <p className="text-sm text-muted-foreground mt-2">
            If this error mentions a required index, please check your Firebase console to create it.
          </p>
        </div>
      )}

      {!isLoading && !error && products.length === 0 && (
        <div className="text-center py-16">
          <PackageSearch className="mx-auto h-16 w-16 text-muted-foreground mb-6" />
          <h2 className="text-2xl font-semibold text-foreground mb-3">No Products Found</h2>
          <p className="text-muted-foreground">
            No products match your current filters. Try a different category or check back later.
          </p>
        </div>
      )}

      {!isLoading && !error && products.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}

      {/* Pagination (Placeholder - Real-time might make traditional pagination complex) */}
      {!isLoading && !error && products.length > 5 && ( // Show if more than 5 products, adjust as needed
        <div className="mt-12 flex justify-center">
          <div className="flex gap-2">
            <Button variant="outline" disabled>Previous</Button>
            <Button variant="outline">1</Button>
            <Button variant="outline" disabled>Next</Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">Pagination with real-time updates needs careful implementation.</p>
        </div>
      )}
    </div>
  );
}

export default function ProductsPage() {
  return (
    <Suspense fallback={<div className="container mx-auto flex justify-center items-center min-h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>}>
      <ProductsPageContent />
    </Suspense>
  );
}