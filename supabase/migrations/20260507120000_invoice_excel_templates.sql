-- 인보이스 엑셀 양식 메타 + Storage 경로
-- 1) Dashboard → Storage에서 버킷 `invoice-excel-templates` 생성 (이 마이그레이션에서도 생성 시도)
-- 2) `.xlsx` 파일 업로드 후 public.invoice_excel_templates 에 행 추가 (storage_path = 객체 경로)

create table if not exists public.invoice_excel_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  storage_path text not null,
  field_mappings jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.invoice_excel_templates is '인보이스 엑셀 양식: Storage의 xlsx 경로와 셀/테이블 매핑(JSON)';

create index if not exists invoice_excel_templates_active_default_idx
  on public.invoice_excel_templates (is_active, is_default)
  where is_active = true;

alter table public.invoice_excel_templates enable row level security;

create policy "invoice_excel_templates_select_authenticated"
  on public.invoice_excel_templates
  for select
  to authenticated
  using (is_active = true);

insert into storage.buckets (id, name, public)
values ('invoice-excel-templates', 'invoice-excel-templates', false)
on conflict (id) do nothing;

create policy "invoice_excel_templates_storage_select"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'invoice-excel-templates');

-- 업로드는 대시보드(service_role) 또는 별도 관리자 정책으로 제한하는 것을 권장합니다.

/*
field_mappings 예시 (프론트엔드와 동일 스키마):

{
  "defaultSheet": "Sheet1",
  "cells": {
    "B2": "report_title",
    "B3": "vessel",
    "B4": "subject",
    "B5": "period_label"
  },
  "table": {
    "sheet": "Sheet1",
    "startRow": 10,
    "columns": {
      "A": "date",
      "B": "day",
      "C": "date_formatted",
      "D": "time_from",
      "E": "time_to",
      "F": "description",
      "G": "total_hours",
      "H": "weekday_normal",
      "I": "weekday_after",
      "J": "weekend_normal",
      "K": "weekend_after",
      "L": "travel_weekday",
      "M": "travel_weekend"
    }
  }
}

메타 키: report_title, period_start, period_end, period_label, vessel, subject, author,
        engine, location, vehicle, report_count

행 키: date, day, date_formatted, time_from, time_to, description, total_hours,
       weekday_normal, weekday_after, weekend_normal, weekend_after,
       travel_weekday, travel_weekend
*/
