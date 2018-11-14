/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict'
/**
 * Write your transction processor functions here
 */

/**
 * Sample transaction
 * @param {org.catena.SampleTransaction} sampleTransaction
 * @transaction
 */
// async function sampleTransaction(tx) {
//     // Save the old value of the asset.
//     const oldValue = tx.asset.value

//     // Update the asset with the new value.
//     tx.asset.value = tx.newValue

//     // Get the asset registry for the asset.
//     const assetRegistry = await getAssetRegistry('org.catena.SampleAsset')
//     // Update the asset in the asset registry.
//     await assetRegistry.update(tx.asset)

//     // Emit an event for the modified asset.
//     let event = getFactory().newEvent('org.catena', 'SampleEvent')
//     event.asset = tx.asset
//     event.oldValue = oldValue
//     event.newValue = tx.newValue
//     emit(event)
// }

/**
 * Create Supply Chain request transaction
 * @param {org.catena.createSupplyRequest} tx
 * @transaction
 */
async function createSupplyRequest (tx) {
    const registry = await getAssetRegistry('org.catena.SupplyRequest')
    var assets = await registry.getAll()
    var factory = getFactory()

    var NS = 'org.catena'
    var SRID = (assets.length + 1).toString()

    var sr = factory.newResource(NS, 'SupplyRequest', SRID)

    sr.requestDate = tx.requestDate
    sr.fuelType = tx.fuelType
    sr.qualitySpecification = tx.qualitySpecification
    sr.volume = tx.volume
    sr.deliveryDate = tx.deliveryDate
    sr.deliveryLocation = tx.deliveryLocation
    sr.customer = tx.customer
    sr.distributor = tx.distributor
    return registry.add(sr)
}


/**
  * Confirm Supply Transaction
  * @param {org.catena.confirmSupply} tx
  * @transaction
  */
async function confirmSupply(tx) {
    var NS = 'org.catena.SupplyRequest'

    const registry = await getAssetRegistry(NS)

    tx.scr.supplyConfirmed = true

    await registry.update(tx.scr)
}


/**
   * Add supply Request Record
   * @param {org.catena.addSupplyRequestRecord} tx
   * @transaction
   */
async function addSupplyRequestRecord(tx) {
    var NS = 'org.catena.SupplyRequest'

    const registry = await getAssetRegistry(NS)

    tx.scr.supplyRequestRecordHash = tx.supplyRequestRecordHash
    tx.scr.supplyRequestRecordUrl = tx.supplyRequestRecordUrl

    await registry.update(tx.scr)
}


/**
 * Add Purchase Order transaction
 * @param {org.catena.addPurchaseOrder} tx
 * @transaction
 */
async function addPurchaseOrder(tx) {
    var NS = 'org.catena.SupplyRequest'

    const registry = await getAssetRegistry(NS)

    tx.scr.purchaseOrderUrl = tx.purchaseOrderUrl
    tx.scr.purchaseOrderHash = tx.purchaseOrderHash
    await registry.update(tx.scr)
}

/**
 * Add distibutor Invoice Transaction
 * @param {org.catena.addDistributorInvoice} tx
 * @transaction
 */
async function addDistributorInvoice(tx) {
    var NS = 'org.catena.SupplyRequest'

    const registry = await getAssetRegistry(NS)

    tx.scr.distributorInvoiceHash = tx.distributorInvoiceHash
    tx.scr.distributorInvoiceUrl = tx.distributorInvoiceUrl
    await registry.update(tx.scr)
}


/**
 * Create Uplift Order transaction
 * @param {org.catena.createUpliftOrder} tx
 * @transaction
 */
async function createUpliftOrder(tx) {
    const registry = await getAssetRegistry('org.catena.UpliftOrder')

    var factory = getFactory()

    var NS = 'org.catena'

    var assets = await registry.getAll()

    var UOID = (assets.length + 1).toString()

    var uplift = factory.newResource(NS, 'UpliftOrder', UOID)

    uplift.pickupTime = tx.pickupTime
    uplift.mabd = tx.mabd
    uplift.volume = tx.volume
    uplift.origin = tx.origin
    uplift.destination = tx.destination
    uplift.qualitySpecification = tx.qualitySpecification
    uplift.fuelType = tx.fuelType
    uplift.transportCompany = tx.transportCompany

    uplift.SupplyRequest = tx.SupplyRequest
    uplift.distributor = tx.distributor
    uplift.manufacturer = tx.manufacturer
    uplift.transporter = tx.transporter

    return registry.add(uplift)
}

/**
 * Add location history
 * @param {org.catena.addLocationHistory} tx
 * @transaction
 */
async function addLocationHistory (tx) {
    var NS = 'org.catena.UpliftOrder'
    var factory = getFactory()

    const registry = await getAssetRegistry(NS)


    const location = factory.newConcept('org.catena','Location')
    location.longitude = tx.longitude
    location.latitude = tx.latitude

    if(typeof tx.upliftOrder.locationHistory === 'undefined'){
        tx.upliftOrder.locationHistory = [location]
    }else{
        tx.upliftOrder.locationHistory = [...tx.upliftOrder.locationHistory, location]
    }

    await registry.update(tx.upliftOrder)
}

/**
 * Add collection order documnet transaction
 * @param {org.catena.addCollectionOrderDocument} tx
 * @transaction
 */
async function addCollectionOrderDocument (tx) {
    var NS = 'org.catena.UpliftOrder'

    const registry = await getAssetRegistry(NS)

    tx.upliftOrder.collectionOrderDocumentHash = tx.collectionOrderDocumentHash
    tx.upliftOrder.collectionOrderDocumentUrl = tx.collectionOrderDocumentUrl

    await registry.update(tx.upliftOrder)
}



/**
 * add collection receipt document transaction
 * @param {org.catena.addCollectionReceiptDocument} tx
 * @transaction
 */
async function addCollectionReceiptDocument(tx) {
    var NS = 'org.catena.UpliftOrder'

    const registry = await getAssetRegistry(NS)

    tx.upliftOrder.collectionReceiptDocumentHash = tx.collectionReceiptDocumentHash
    tx.upliftOrder.collectionReceiptDocumentUrl = tx.collectionReceiptDocumentUrl

    await registry.update(tx.upliftOrder)
}


/**
 * add manufacturer invoice transaction
 * @param {org.catena.addManufacturerInvoice} tx
 * @transaction
 */
async function addManufacturerInvoice(tx) {
    var NS = 'org.catena.UpliftOrder'

    const registry = await getAssetRegistry(NS)

    tx.upliftOrder.manufacturerInvoiceUrl = tx.manufacturerInvoiceUrl
    tx.upliftOrder.manufacturerInvoiceHash = tx.manufacturerInvoiceHash

    await registry.update(tx.upliftOrder)
}


/**
 * add Transportation Invoice transaction
 * @param {org.catena.addTransportationInvoice} tx
 * @transaction
 */
async function addTransportationInvoice(tx) {
    var NS = 'org.catena.UpliftOrder'

    const registry = await getAssetRegistry(NS)

    tx.upliftOrder.transportationInvoiceUrl = tx.transportationInvoiceUrl
    tx.upliftOrder.transportationInvoiceHash = tx.transportationInvoiceHash

    await registry.update(tx.upliftOrder)
}

/**
 * Confirm collection date transaction
 * @param {org.catena.confirmCollectionDate} tx
 * @transaction
 */
async function confirmCollectionDate(tx) {
    var NS = 'org.catena.UpliftOrder'

    const registry = await getAssetRegistry(NS)

    tx.upliftOrder.collectionDateConfirmed = true

    await registry.update(tx.upliftOrder)

}

/**
 * Create Supply Agreement transaction
 * @param {org.catena.createSupplyAgreement} tx
 * @transaction
 */
async function createSupplyAgreement(tx) {
    const registry = await getAssetRegistry('org.catena.SupplyAgreement')
    var assets = await registry.getAll()
    var factory = getFactory()

    var NS = 'org.catena'
    var SAID = (assets.length + 1).toString()

    var sa = factory.newResource(NS, 'SupplyAgreement', SAID)

    sa.effectiveDate = tx.effectiveDate
    sa.expiryDate = tx.expiryDate
    sa.priceSetDate = tx.priceSetDate
    sa.requestDatePrior = tx.requestDatePrior
    sa.priceStructure = tx.priceStructure
    sa.annualBaseQuantity = tx.annualBaseQuantity
    sa.qualitySpecification = tx.qualitySpecification
    sa.supplyFailTime = tx.supplyFailTime
    sa.wholesaleListPriceTable = tx.wholesaleListPriceTable
    sa.sitesTable = tx.sitesTable
    sa.rebateTable = tx.rebateTable

    sa.customer = tx.customer
    sa.distributor = tx.distributor
    return registry.add(sa)
}

/**
 * add supply chain request transaction
 * @param {org.catena.addSupplyRequest} tx
 * @transaction
 */
async function addSupplyRequest (tx) {
    const registry = await getAssetRegistry('org.catena.SupplyAgreement')

    if(typeof tx.supplyAgreement.SupplyRequests === 'undefined'){
        tx.supplyAgreement.SupplyRequests = [tx.SupplyRequest]
    }else{
        tx.supplyAgreement.SupplyRequests = [...tx.supplyAgreement.SupplyRequests, tx.SupplyRequest]
    }
    registry.update(tx.supplyAgreement)
}
/**
 * add cicero contract Id to the supply agreement
 * @param {org.catena.addCiceroContract} tx
 * @transaction
 */
async function addCiceroContract (tx){
    const registry = await getAssetRegistry('org.catena.SupplyAgreement')

    tx.supplyAgreement.ciceroContractId = tx.ciceroContractId

    return registry.update(tx.supplyAgreement)
}