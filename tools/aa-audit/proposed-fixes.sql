-- PROPOSED, NOT RUN. Needs Mike's OK. Run in one transaction in the Supabase SQL editor.
begin;

-- 1. Storage locations from the AA Inventory Report (2026-04-16). Only fills empty locations.
update pieces set location = 'Camp 3' where id = '8e8a6ed5-9061-4c06-a9d2-d896eab8a11e' and location is null; -- XA-0011 Street walkby
update pieces set location = 'At My Studio' where id = 'fb1b8d69-982f-4e96-ac69-55a991e76b80' and location is null; -- XA-0012 La cova dels colors (Retina 2)
update pieces set location = 'Camp 3' where id = '82e96039-77e1-40d9-b8cf-225705206731' and location is null; -- XA-0017 Seres invisibles
update pieces set location = 'Camp 3' where id = '67e926ab-5aea-4ed5-815c-7adcfb29822f' and location is null; -- XA-0019 Public and private
update pieces set location = 'Hospital Clinic' where id = 'ef3d1658-d1ab-4544-86fd-06d6dc32cb75' and location is null; -- XA-0021 Beach
update pieces set location = 'At My Studio' where id = '08c41e84-e0cd-46dd-a499-00d373e12ddf' and location is null; -- XA-0022 Break More Walls
update pieces set location = 'At My Studio' where id = '0e9a4fde-4749-4745-b069-2107fa7f380a' and location is null; -- XA-0023 City 1 and City 2
update pieces set location = 'Unknown' where id = 'e10e66ff-90d6-46bb-a8ae-57111991f968' and location is null; -- XA-0024 Drops 1
update pieces set location = 'Camp 3' where id = '33116187-9675-4782-bebe-fe52aef52b22' and location is null; -- XA-0027 Celebration
update pieces set location = 'Camp 3' where id = '0128302a-0077-4962-a94c-084f91776dce' and location is null; -- XA-0031 Burning Room
update pieces set location = 'Camp 3' where id = '497dc447-3dc1-4676-8843-48a44706da78' and location is null; -- XA-0032 Finestra oberta
update pieces set location = 'Camp 3' where id = '760fb038-e1cc-46b9-9162-22cf4fd777fa' and location is null; -- XA-0033 Lo viejo y lo nuevo
update pieces set location = 'Camp 3' where id = '64d0fc29-d6bc-463a-9150-f4813327bf8f' and location is null; -- XA-0034 Pintar la natura
update pieces set location = 'Camp 3' where id = '9cc444a4-f97c-4615-9099-19e7a3c6b3e8' and location is null; -- XA-0035 Abstraccio de paisatge
update pieces set location = 'Camp 3' where id = 'ba08a319-05ae-46fa-a476-a6f63110aa76' and location is null; -- XA-0036 Abstraccio de paisatge 2
update pieces set location = 'Camp 3' where id = '32fea2d3-88ba-433b-a3a6-8e053dfb9748' and location is null; -- XA-0037 Caterina
update pieces set location = 'Camp 3' where id = 'daf9b903-9289-451d-a5c3-0d9135e1e1f3' and location is null; -- XA-0038 Pintar la natura 2
update pieces set location = 'Camp 3' where id = 'a695e2e8-50f1-4b16-afd9-183d3acdfded' and location is null; -- XA-0039 Tornar al origen
update pieces set location = 'Camp 3' where id = '5974a7c3-ec59-47c9-b646-7b08e15fb657' and location is null; -- XA-0040 Dark hour
update pieces set location = 'Camp 3' where id = 'b80a14ae-ef6a-49d1-b789-4a7900975309' and location is null; -- XA-0041 Les Ferreres
update pieces set location = 'Camp 3' where id = '31824f7a-e535-40d3-abb3-2cf38f603561' and location is null; -- XA-0042 Luz blanca / White Light
update pieces set location = 'Camp 3' where id = 'ac36e2e6-0cb5-48b7-85b8-520b8af12dc2' and location is null; -- XA-0043 Studio formula
update pieces set location = 'Camp 3' where id = '2019f7c0-9de0-4338-911a-bb1c9529b3d2' and location is null; -- XA-0044 Ciutat oberta
update pieces set location = 'Camp 3' where id = '4c2cabd9-efb4-40f4-a420-b99e27f9d09a' and location is null; -- XA-0045 Red table with yellow bird
update pieces set location = 'Camp 3' where id = '32d9442f-284c-4100-9e36-590904568474' and location is null; -- XA-0046 Studio corner
update pieces set location = 'Camp 3' where id = '5d4e883a-0510-4a7d-b9de-d48c71e781e7' and location is null; -- XA-0047 La mente tambien juega (Opening)
update pieces set location = 'Camp 3' where id = 'a567440c-59c8-4c5c-9fc3-cbec5277e390' and location is null; -- XA-0048 Lets Dance
update pieces set location = 'Camp 3' where id = 'f6543927-7596-49b1-912e-26a8f6142d61' and location is null; -- XA-0053 Hot pipes
update pieces set location = 'Camp 3' where id = '365f08bb-3d17-4999-b115-24e890905c52' and location is null; -- XA-0055 Ingeni II
update pieces set location = 'Camp 3' where id = '23d65f36-5759-4fda-828a-888cc50d59af' and location is null; -- XA-0057 Ingeni petit
update pieces set location = 'At My Studio' where id = 'e4b919c8-494c-41ec-bfa9-32be20dfe6b7' and location is null; -- XA-0060 Laberint
update pieces set location = 'Camp 3' where id = '8ed7fa92-219c-401a-9b48-cb792f23e7e8' and location is null; -- XA-0061 Laboratori
update pieces set location = 'Camp 3' where id = '0c2f1dae-eb93-4bce-9398-5b09ea694379' and location is null; -- XA-0063 Mecanic
update pieces set location = 'Camp 3' where id = 'e080d63a-8796-4ee6-8e7e-955531911649' and location is null; -- XA-0064 Monotipo
update pieces set location = 'Camp 3' where id = 'e8bed7ff-0b85-489d-8233-6b43a19f3208' and location is null; -- XA-0065 Red Pipe
update pieces set location = 'Camp 3' where id = '8b183fd2-3500-45e6-bb53-3308c099d35f' and location is null; -- XA-0066 Secret formula
update pieces set location = 'Camp 3' where id = '149191f8-c1ad-40ce-8007-0cc43e74871b' and location is null; -- XA-0067 Sota No
update pieces set location = 'Camp 3' where id = '1d828360-a2bb-4686-804e-bcc1a8f1c1e4' and location is null; -- XA-0070 Painting mix
update pieces set location = 'Camp 3' where id = '8e8ccfc8-e0c4-438e-8a7a-a2495b5a1844' and location is null; -- XA-0071 Paisatge pintat
update pieces set location = 'Camp 3' where id = '36d583b9-847b-4633-b5fa-96bfe59e344c' and location is null; -- XA-0073 Dos figuras
update pieces set location = 'Camp 3' where id = '97806496-ac5b-4610-af29-6c227ea683d9' and location is null; -- XA-0074 House
update pieces set location = 'Camp 3' where id = '5900d325-34fa-4b5e-ac6f-7ae53d2811ea' and location is null; -- XA-0075 No Se Conocen
update pieces set location = 'Camp 3' where id = '914db6f8-2833-4349-b926-9691397b4b99' and location is null; -- XA-0076 Big Move
update pieces set location = 'Camp 3' where id = '353dfdfb-db99-48d6-903d-9ec87e987d25' and location is null; -- XA-0078 La Visita
update pieces set location = 'Camp 3' where id = '7f0e31d3-37b1-4c41-b3a0-9027c7ceea3c' and location is null; -- XA-0083 Wallpaper city
update pieces set location = 'Camp 3' where id = '0a9fe96c-adab-4c38-82b6-a7644c6d47c7' and location is null; -- XA-0084 Estudi de estudi
update pieces set location = 'Camp 3' where id = 'afac76c0-68d7-474b-a833-ccb81442e41a' and location is null; -- XA-0085 Candy fallout
update pieces set location = 'Camp 3' where id = 'a7c582b5-8e4d-48f4-8ce2-a1bfb20275c3' and location is null; -- XA-0086 Desnudo
update pieces set location = 'Camp 3' where id = '3c7d0d79-c0c1-46d9-9cc2-d0c32ee0a52f' and location is null; -- XA-0087 Doce y diez
update pieces set location = 'Camp 3' where id = '0562bdd2-9330-4988-a452-0130d7ed3134' and location is null; -- XA-0088 Plantas
update pieces set location = 'Camp 3' where id = '3df998f2-ec88-4ba3-bcec-123fe6fe8250' and location is null; -- XA-0089 Taula de treball
update pieces set location = 'At My Studio' where id = 'bbbee20a-69da-4696-9a75-f8814c639d80' and location is null; -- XA-0091 Martini lady
update pieces set location = 'Camp 3' where id = '89195b5f-22c9-4f3b-bfb5-4249a2cd2c40' and location is null; -- XA-0097 Las abuelas
update pieces set location = 'Camp 3' where id = '3da48f3c-c50d-4a74-9775-1d7d16f2b564' and location is null; -- XA-0100 Multiples realitats
update pieces set location = 'Camp 3' where id = '4469026e-e86e-4582-ab2a-b170ad7f8c7d' and location is null; -- XA-0101 Pineda de Olle Pinell

-- 2. Price missing from the import (AA shows $5,000).
update pieces set price = 5000, currency = 'USD' where id = 'ed8c4315-f908-4c29-81f4-e8880e766f42' and price is null; -- XA-0008

-- 3. Remove the 8 duplicate rows the import created (no image, no year, no AA page, not in any collection).
--    The guards make each delete a no-op if the row has gained an image, a collection or an edition since.
delete from pieces p where p.id = '0e426e1c-8b2e-42ef-9edb-dc298bd464c9' and not exists (select 1 from piece_images i where i.piece_id = p.id) and not exists (select 1 from collection_pieces c where c.piece_id = p.id) and not exists (select 1 from piece_editions e where e.piece_id = p.id); -- XA-0093 Dirty dishes (dirty-dishes)
delete from pieces p where p.id = 'e31f789e-a461-4536-b5a6-162de4c47058' and not exists (select 1 from piece_images i where i.piece_id = p.id) and not exists (select 1 from collection_pieces c where c.piece_id = p.id) and not exists (select 1 from piece_editions e where e.piece_id = p.id); -- XA-0094 Estudi de estudi (estudi-de-estudi-2)
delete from pieces p where p.id = '38821b6e-2cd1-45a0-a787-d953a7315635' and not exists (select 1 from piece_images i where i.piece_id = p.id) and not exists (select 1 from collection_pieces c where c.piece_id = p.id) and not exists (select 1 from piece_editions e where e.piece_id = p.id); -- XA-0095 Hot pipes (hot-pipes-2)
delete from pieces p where p.id = '6bd50d40-1ab9-4d6f-9a79-45fda95036ac' and not exists (select 1 from piece_images i where i.piece_id = p.id) and not exists (select 1 from collection_pieces c where c.piece_id = p.id) and not exists (select 1 from piece_editions e where e.piece_id = p.id); -- XA-0096 Ingeni petit (ingeni-petit-2)
delete from pieces p where p.id = 'e5f3abbd-4f32-4fe4-944e-8c62736917ce' and not exists (select 1 from piece_images i where i.piece_id = p.id) and not exists (select 1 from collection_pieces c where c.piece_id = p.id) and not exists (select 1 from piece_editions e where e.piece_id = p.id); -- XA-0098 Luz blanca /White Ligth (luz-blanca-white-ligth-2)
delete from pieces p where p.id = 'b53e77ad-1fc4-4bf4-bdda-de264912cba3' and not exists (select 1 from piece_images i where i.piece_id = p.id) and not exists (select 1 from collection_pieces c where c.piece_id = p.id) and not exists (select 1 from piece_editions e where e.piece_id = p.id); -- XA-0099 Monotipo (monotipo)
delete from pieces p where p.id = '0b3c07cd-c898-4de6-a64b-f2ed0a48cf5d' and not exists (select 1 from piece_images i where i.piece_id = p.id) and not exists (select 1 from collection_pieces c where c.piece_id = p.id) and not exists (select 1 from piece_editions e where e.piece_id = p.id); -- XA-0102 Sense parets (sense-parets-2)
delete from pieces p where p.id = 'f6a06f5a-7bce-4bc4-bc85-69deb98a913a' and not exists (select 1 from piece_images i where i.piece_id = p.id) and not exists (select 1 from collection_pieces c where c.piece_id = p.id) and not exists (select 1 from piece_editions e where e.piece_id = p.id); -- XA-0103 Seres invisibles (seres-invisibles-2)

-- Expect: 55 + 1 updates, 8 deletes; then 95 pieces, 94 public. Check before commit:
select count(*) total, count(*) filter (where is_public) public, count(location) with_location from pieces where artist_id = 'fa198acd-eb06-44b2-8921-a1eac2cccff5';
-- commit;  (or rollback;)
