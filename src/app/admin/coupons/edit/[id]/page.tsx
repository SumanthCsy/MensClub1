
// @/app/admin/coupons/edit/[id]/page.tsx
"use client";

import { useState, useEffect, FormEvent } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, Ticket, Save, Loader2, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Coupon } from '@/types';
import { doc, getDoc, updateDoc, Timestamp } from "firebase/firestore";
import { db } from '@/lib/firebase';
import { format } from 'date-fns';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

// Helper to format Date or Timestamp to 'yyyy-MM-ddTHH:mm' for datetime-local input
const formatDateForInput = (date: any): string => {
    if (!date) return '';
    try {
        const d = date instanceof Timestamp ? date.toDate() : new Date(date);
        if (isNaN(d.getTime())) return '';
        return format(d, "yyyy-MM-dd'T'HH:mm");
    } catch (error) {
        console.warn("Error formatting date for input:", date, error);
        return '';
    }
};

type CouponEditFormData = Omit<Coupon, 'id' | 'createdAt' | 'expiryDate' | 'minPurchaseAmount'> & {
  expiryDateInput?: string;
  minPurchaseAmountInput?: string;
  discountValueInput: string;
};

export default function EditCouponPage() {
  const params = useParams();
  const router = useRouter();
  const couponId = params.id as string;

  const [formData, setFormData] = useState<Partial<CouponEditFormData>>({});
  const [originalCoupon, setOriginalCoupon] = useState<Coupon | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (couponId) {
      const fetchCoupon = async () => {
        setIsLoading(true);
        setError(null);
        try {
          const couponRef = doc(db, "coupons", couponId);
          const couponSnap = await getDoc(couponRef);
          if (couponSnap.exists()) {
            const couponData = { id: couponSnap.id, ...couponSnap.data() } as Coupon;
            setOriginalCoupon(couponData);
            setFormData({
              code: couponData.code,
              discountType: couponData.discountType,
              discountValueInput: couponData.discountValue.toString(),
              expiryDateInput: formatDateForInput(couponData.expiryDate),
              minPurchaseAmountInput: couponData.minPurchaseAmount?.toString() || '',
              displayOnSite: couponData.displayOnSite,
              isActive: couponData.isActive,
            });
          } else {
            setError("Coupon not found.");
            toast({ title: "Error", description: "Coupon not found.", variant: "destructive" });
          }
        } catch (err) {
          console.error("Error fetching coupon:", err);
          setError("Failed to fetch coupon details.");
          toast({ title: "Error", description: "Failed to load coupon details.", variant: "destructive" });
        } finally {
          setIsLoading(false);
        }
      };
      fetchCoupon();
    } else {
      setError("No coupon ID provided.");
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [couponId, toast]);

  const [error, setError] = useState<string | null>(null);


  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };
  
  const handleSwitchChange = (name: 'displayOnSite' | 'isActive', checked: boolean) => {
    setFormData(prev => ({ ...prev, [name]: checked }));
  };

  const handleDiscountTypeChange = (value: 'percentage' | 'fixed') => {
    setFormData(prev => ({ ...prev, discountType: value }));
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!originalCoupon || !formData) {
      toast({ title: "Error", description: "Coupon data not fully loaded.", variant: "destructive"});
      return;
    }
    setIsSubmitting(true);

    const discountValue = parseFloat(formData.discountValueInput || '0');
    const minPurchaseAmount = formData.minPurchaseAmountInput ? parseFloat(formData.minPurchaseAmountInput) : null;

    if (!formData.code?.trim()) {
      toast({ title: "Coupon Code Required", description: "Please enter a coupon code.", variant: "destructive" });
      setIsSubmitting(false);
      return;
    }
    if (isNaN(discountValue) || discountValue <= 0) {
      toast({ title: "Invalid Discount Value", description: "Discount value must be a number greater than zero.", variant: "destructive" });
      setIsSubmitting(false);
      return;
    }
     if (minPurchaseAmount !== null && (isNaN(minPurchaseAmount) || minPurchaseAmount < 0)) {
      toast({ title: "Invalid Minimum Purchase", description: "Minimum purchase amount must be a non-negative number.", variant: "destructive"});
      setIsSubmitting(false);
      return;
    }

    const couponDataToUpdate: Partial<Coupon> = {
      code: formData.code.trim().toUpperCase(),
      discountType: formData.discountType,
      discountValue: discountValue,
      expiryDate: formData.expiryDateInput ? new Date(formData.expiryDateInput) : null,
      minPurchaseAmount: minPurchaseAmount === null || isNaN(minPurchaseAmount) ? undefined : minPurchaseAmount,
      displayOnSite: formData.displayOnSite,
      isActive: formData.isActive,
    };
    
    // Remove optional fields if they are null to avoid issues with Firestore update
    if (couponDataToUpdate.expiryDate === null) {
      delete couponDataToUpdate.expiryDate;
    }
    if (couponDataToUpdate.minPurchaseAmount === undefined) {
      delete couponDataToUpdate.minPurchaseAmount;
    }

    const couponRef = doc(db, "coupons", couponId);
    updateDoc(couponRef, couponDataToUpdate)
    .then(() => {
        toast({
            title: "Coupon Updated!",
            description: `Coupon ${couponDataToUpdate.code} has been successfully updated.`,
            duration: 7000,
        });
        router.push('/admin/coupons');
    })
    .catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({
            path: couponRef.path,
            operation: 'update',
            requestResourceData: couponDataToUpdate,
        });
        errorEmitter.emit('permission-error', permissionError);
    })
    .finally(() => {
        setIsSubmitting(false);
    });
  };

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-screen-md px-4 sm:px-6 lg:px-8 py-12 md:py-16 text-center">
        <Loader2 className="mx-auto h-12 w-12 text-primary animate-spin mb-4" />
        <p className="text-lg text-muted-foreground">Loading coupon details for editing...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto max-w-screen-md px-4 sm:px-6 lg:px-8 py-12 md:py-16 text-center">
        <AlertTriangle className="mx-auto h-12 w-12 text-destructive mb-4" />
        <p className="text-lg text-destructive">{error}</p>
        <Button asChild className="mt-4">
          <Link href="/admin/coupons">Back to Coupons</Link>
        </Button>
      </div>
    );
  }
  
  if (!originalCoupon) {
     return (
      <div className="container mx-auto max-w-screen-md px-4 sm:px-6 lg:px-8 py-12 md:py-16 text-center">
        <AlertTriangle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-lg text-muted-foreground">Coupon data could not be loaded.</p>
         <Button asChild className="mt-4">
          <Link href="/admin/coupons">Back to Coupons</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-screen-md px-4 sm:px-6 lg:px-8 py-12 md:py-16">
      <div className="mb-8">
        <Button variant="outline" size="sm" asChild className="mb-4">
          <Link href="/admin/coupons">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Coupons
          </Link>
        </Button>
        <div className="flex items-center gap-3">
            <Ticket className="h-10 w-10 text-primary" />
            <div>
                <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-foreground">Edit Coupon</h1>
                <p className="mt-1 text-md text-muted-foreground">Modifying coupon: {originalCoupon.code}</p>
            </div>
        </div>
      </div>
      
      <Card className="shadow-xl border-border/60">
        <CardHeader>
            <CardTitle>Coupon Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="code">Coupon Code</Label>
              <Input id="code" name="code" value={formData.code || ''} onChange={handleChange} placeholder="e.g., SUMMER20" required className="uppercase text-base h-11"/>
              <p className="text-xs text-muted-foreground">Customers will use this code at checkout. (Will be auto-uppercased)</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="discountType">Discount Type</Label>
                <Select value={formData.discountType} onValueChange={handleDiscountTypeChange}>
                  <SelectTrigger className="h-11 text-base">
                    <SelectValue placeholder="Select discount type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage (%)</SelectItem>
                    <SelectItem value="fixed">Fixed Amount (₹)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="discountValueInput">Discount Value</Label>
                <Input
                  id="discountValueInput"
                  name="discountValueInput"
                  type="number"
                  value={formData.discountValueInput || ''}
                  onChange={handleChange}
                  placeholder={formData.discountType === 'percentage' ? "e.g., 10 for 10%" : "e.g., 100 for ₹100"}
                  required
                  step="0.01"
                  min="0.01"
                  className="text-base h-11"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="expiryDateInput">Expiry Date (Optional)</Label>
                <Input id="expiryDateInput" name="expiryDateInput" type="datetime-local" value={formData.expiryDateInput || ''} onChange={handleChange} className="text-base h-11"/>
              </div>
              <div className="space-y-2">
                <Label htmlFor="minPurchaseAmountInput">Min. Purchase Amount (₹, Optional)</Label>
                <Input id="minPurchaseAmountInput" name="minPurchaseAmountInput" type="number" value={formData.minPurchaseAmountInput || ''} onChange={handleChange} placeholder="e.g., 500" step="0.01" min="0" className="text-base h-11"/>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <Switch id="displayOnSite" checked={formData.displayOnSite || false} onCheckedChange={(checked) => handleSwitchChange('displayOnSite', checked)} />
              <Label htmlFor="displayOnSite" className="text-base">Display this coupon on the site</Label>
            </div>

            <div className="flex items-center space-x-3">
              <Switch id="isActive" checked={formData.isActive === undefined ? true : formData.isActive} onCheckedChange={(checked) => handleSwitchChange('isActive', checked)} />
              <Label htmlFor="isActive" className="text-base">Coupon is Active</Label>
            </div>

            <div className="flex justify-end pt-4">
              <Button type="submit" size="lg" className="text-base" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Saving Changes...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-5 w-5" /> Save Changes
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
