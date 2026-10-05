"use client";

import { useState } from "react";
import { inputClass } from "@/lib/form-state";

/** Datos del receptor de la factura: consumidor final, con DNI o con CUIT y condición frente al IVA. */
export function InvoiceFields({ bookingId, defaultDni, hasEmail }: { bookingId: string; defaultDni?: string | null; hasEmail: boolean }) {
  const [docType, setDocType] = useState(defaultDni ? "96" : "99");
  return (
    <div className="space-y-3">
      <input type="hidden" name="bookingId" value={bookingId} />
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block text-sm">
          Factura a
          <select name="docType" value={docType} onChange={(e) => setDocType(e.target.value)} className={inputClass}>
            <option value="99">Consumidor final</option>
            <option value="96">Consumidor final con DNI</option>
            <option value="80">CUIT</option>
          </select>
        </label>
        {docType !== "99" && (
          <label className="block text-sm">
            {docType === "96" ? "DNI" : "CUIT"}
            <input
              name="docNumber"
              required
              inputMode="numeric"
              defaultValue={docType === "96" ? (defaultDni ?? "") : ""}
              placeholder={docType === "96" ? "30123456" : "20-12345678-6"}
              className={inputClass}
            />
          </label>
        )}
        {docType === "80" && (
          <label className="block text-sm">
            Condición frente al IVA
            <select name="vatCondition" defaultValue="5" className={inputClass}>
              <option value="5">Consumidor final</option>
              <option value="6">Responsable monotributo</option>
              <option value="1">IVA Responsable inscripto</option>
              <option value="4">IVA Sujeto exento</option>
            </select>
          </label>
        )}
      </div>
      {hasEmail && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="sendEmail" defaultChecked /> Mandarle el comprobante por email
        </label>
      )}
    </div>
  );
}
