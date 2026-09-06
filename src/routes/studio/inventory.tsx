import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { PRODUCT_CATEGORIES } from "@/lib/catalog";
import { money } from "@/lib/format";
import { useSalon } from "@/lib/store";
import type { Product } from "@/lib/types";

export const Route = createFileRoute("/studio/inventory")({ component: InventoryPage });

function InventoryPage() {
  const products = useSalon((s) => s.products);
  const adjustStock = useSalon((s) => s.adjustStock);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);

  const retail = products.filter((p) => p.category !== "Gift");
  const gifts = products.filter((p) => p.category === "Gift");

  function receive(id: string, delta: number) {
    adjustStock(id, delta);
    toast.success(delta > 0 ? "Stock received" : "Stock adjusted");
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Back bar</p>
          <h1 className="font-serif text-3xl font-medium">Inventory</h1>
          <p className="mt-1 text-sm text-muted-foreground">Add, edit, and count retail. Gift cards stay on their own shelf.</p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          Add product
        </Button>
      </div>

      <div className="mt-6 overflow-x-auto rounded-2xl bg-card shadow-[var(--shadow-border)]">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              <th className="px-4 py-3 font-medium">Product</th>
              <th className="px-4 py-3 font-medium">SKU</th>
              <th className="px-4 py-3 font-medium">Price</th>
              <th className="px-4 py-3 font-medium">On hand</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {retail.map((p) => (
              <tr key={p.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3">
                  <button
                    type="button"
                    className="text-left"
                    onClick={() => {
                      setEditing(p);
                      setOpen(true);
                    }}
                  >
                    <p className="font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.category}</p>
                  </button>
                </td>
                <td className="px-4 py-3 tabular-nums text-muted-foreground">{p.sku}</td>
                <td className="px-4 py-3 tabular-nums">{money(p.price)}</td>
                <td className="px-4 py-3">
                  <Badge variant={p.stock === 0 ? "danger" : p.stock <= 5 ? "warning" : "success"}>{p.stock}</Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => receive(p.id, -1)}>
                      −1
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => receive(p.id, 6)}>
                      +6
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditing(p);
                        setOpen(true);
                      }}
                    >
                      Edit
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {gifts.length > 0 ? (
        <p className="mt-4 text-xs text-muted-foreground">
          Gift cards on the shop: {gifts.map((g) => g.name).join(" · ")}. They do not count as units.
        </p>
      ) : null}

      <ProductDialog open={open} product={editing} onClose={() => setOpen(false)} />
    </div>
  );
}

function ProductDialog({
  open,
  product,
  onClose,
}: {
  open: boolean;
  product: Product | null;
  onClose: () => void;
}) {
  const upsert = useSalon((s) => s.upsertProduct);
  const remove = useSalon((s) => s.removeProduct);
  const [form, setForm] = useState({
    name: "",
    category: "Hair",
    price: 32,
    stock: 12,
    sku: "",
    description: "",
  });

  const primed = product?.id ?? (open ? "new" : "");
  useEffect(() => {
    if (!open) return;
    if (product) {
      setForm({
        name: product.name,
        category: product.category,
        price: product.price,
        stock: product.stock,
        sku: product.sku,
        description: product.description,
      });
    } else {
      setForm({ name: "", category: "Hair", price: 32, stock: 12, sku: "", description: "" });
    }
  }, [primed, open, product]);

  function save(e: FormEvent) {
    e.preventDefault();
    const result = upsert({ ...form, id: product?.id, price: Number(form.price), stock: Number(form.stock) });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(product ? "Product updated" : "Product added");
    onClose();
  }

  function drop() {
    if (!product) return;
    const result = remove(product.id);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Product removed");
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={product ? product.name : "New product"} className="max-h-[min(88dvh,720px)] overflow-y-auto">
        <form onSubmit={save} className="mt-4 flex flex-col gap-3">
          <Field label="Name">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Heat shield spray" />
          </Field>
          <Field label="Category">
            <NativeSelect value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {PRODUCT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Price">
              <Input
                type="number"
                min={1}
                step="1"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
              />
            </Field>
            <Field label="On hand">
              <Input
                type="number"
                min={0}
                step="1"
                value={form.stock}
                onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })}
              />
            </Field>
          </div>
          <Field label="SKU">
            <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value.toUpperCase() })} placeholder="Auto if blank" />
          </Field>
          <Field label="Description">
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="What we tell guests at the desk."
            />
          </Field>
          <div className="mt-2 flex flex-wrap justify-end gap-2">
            {product ? (
              <Button type="button" variant="ghost" className="mr-auto text-destructive" onClick={drop}>
                Remove
              </Button>
            ) : null}
            <Button type="button" variant="ghost" onClick={onClose}>
              Dismiss
            </Button>
            <Button type="submit" variant="ink">
              Save
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
