
// @/components/checkout/shipping-form.tsx
"use client";

import { useEffect } from 'react'; // Import useEffect
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
// Label is not directly used from here if using FormLabel
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '../ui/separator';

const shippingFormSchema = z.object({
  email: z.string().email({ message: "Invalid email address." }),
  fullName: z.string().min(2, { message: "Full name must be at least 2 characters." }),
  addressLine1: z.string().min(5, { message: "Address is too short." }),
  addressLine2: z.string().optional(),
  city: z.string().min(2, { message: "City name is too short." }),
  stateProvince: z.string().min(2, { message: "State/Province is too short." }),
  postalCode: z.string().min(5, { message: "Postal code must be at least 5 characters." }),
  country: z.string().min(2, { message: "Country name is too short." }),
  phoneNumber: z.string().min(10, { message: "Phone number must be at least 10 digits." }).optional(),
});

export type ShippingFormValues = z.infer<typeof shippingFormSchema>;

interface ShippingFormProps {
  onSubmit: (data: ShippingFormValues) => void;
  initialData?: Partial<ShippingFormValues>;
}

export function ShippingForm({ onSubmit, initialData = {} }: ShippingFormProps) {
  const form = useForm<ShippingFormValues>({
    resolver: zodResolver(shippingFormSchema),
    defaultValues: { // Set clear defaults for all fields
      email: initialData.email || "",
      fullName: initialData.fullName || "",
      addressLine1: initialData.addressLine1 || "",
      addressLine2: initialData.addressLine2 || "",
      city: initialData.city || "",
      stateProvince: initialData.stateProvince || "",
      postalCode: initialData.postalCode || "",
      country: initialData.country || "India",
      phoneNumber: initialData.phoneNumber || "",
    },
  });

  // Effect to reset form when initialData changes
  useEffect(() => {
    form.reset({
      email: initialData.email || "",
      fullName: initialData.fullName || "",
      addressLine1: initialData.addressLine1 || "",
      addressLine2: initialData.addressLine2 || "",
      city: initialData.city || "",
      stateProvince: initialData.stateProvince || "",
      postalCode: initialData.postalCode || "",
      country: initialData.country || "India",
      phoneNumber: initialData.phoneNumber || "",
    });
  }, [initialData, form]);

  return (
    <Card className="shadow-lg border border-border/60">
      <CardHeader>
        <CardTitle className="text-2xl font-semibold">Shipping Address</CardTitle>
        <CardDescription>Please enter your shipping details.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email Address</FormLabel>
                  <FormControl>
                    <Input placeholder="you@gmail.com" {...field} className="h-11 text-base" suppressHydrationWarning={true} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Your Name" {...field} className="h-11 text-base" suppressHydrationWarning={true}/>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="addressLine1"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address Line 1</FormLabel>
                  <FormControl>
                    <Input placeholder="123 Main St" {...field} className="h-11 text-base" suppressHydrationWarning={true}/>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="addressLine2"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address Line 2 (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Apt, Suite, Building" {...field} className="h-11 text-base" suppressHydrationWarning={true}/>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>City</FormLabel>
                    <FormControl>
                      <Input placeholder="Keshavapatnam" {...field} className="h-11 text-base" suppressHydrationWarning={true}/>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="stateProvince"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>State / Province</FormLabel>
                    <FormControl>
                      <Input placeholder="Telangana" {...field} className="h-11 text-base" suppressHydrationWarning={true}/>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="postalCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Postal Code</FormLabel>
                    <FormControl>
                      <Input placeholder="505451" {...field} className="h-11 text-base" suppressHydrationWarning={true}/>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="country"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Country</FormLabel>
                    <FormControl>
                      <Input placeholder="India" {...field} className="h-11 text-base" suppressHydrationWarning={true}/>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="phoneNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone Number (Optional)</FormLabel>
                  <FormControl>
                    <Input type="tel" placeholder="+91 XXXXX XXXXX" {...field} className="h-11 text-base" suppressHydrationWarning={true}/>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Separator className="my-8" />
             <Button type="submit" size="lg" className="w-full">
              Save & Use This Address
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
