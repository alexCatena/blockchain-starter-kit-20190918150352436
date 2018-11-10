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
async function sampleTransaction(tx) {
    // Save the old value of the asset.
    const oldValue = tx.asset.value

    // Update the asset with the new value.
    tx.asset.value = tx.newValue

    // Get the asset registry for the asset.
    const assetRegistry = await getAssetRegistry('org.catena.SampleAsset')
    // Update the asset in the asset registry.
    await assetRegistry.update(tx.asset)

    // Emit an event for the modified asset.
    let event = getFactory().newEvent('org.catena', 'SampleEvent')
    event.asset = tx.asset
    event.oldValue = oldValue
    event.newValue = tx.newValue
    emit(event)
}

/**
 * Create Supply Chain request transaction
 * @param {org.catena.createSupplyChainRequest} tx
 * @transaction
 */
async function createSupplyChainRequest (tx) {
    const registry = await getAssetRegistry('org.catena.SupplyChainRequest')
    var assets = await registry.getAll()
    var factory = getFactory()

    var NS = 'org.catena'
    var SCRID = (assets.length + 1).toString()

    var scr = factory.newResource(NS, 'SupplyChainRequest', SCRID)

    scr.volume = tx.volume
    scr.fuelType = tx.fuelType
    scr.cost = tx.cost
    scr.deliveryDate = tx.deliveryDate
    scr.requestDate = tx.requestDate
    scr.customer = tx.customer
    scr.distributor = tx.distributor
    scr.deliveryLocation = tx.deliveryLocation
    scr.deliveryMethod = tx.deliveryMethod
    scr.requestDate = tx.requestDate
    return registry.add(scr)
}


/**
  * Confirm Supply Transaction
  * @param {org.catena.confirmSupply} tx
  * @transaction
  */
async function confirmSupply(tx) {
    var NS = 'org.catena.SupplyChainRequest'

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
    var NS = 'org.catena.SupplyChainRequest'

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
    var NS = 'org.catena.SupplyChainRequest'

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
    var NS = 'org.catena.SupplyChainRequest'

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
    uplift.deliveryMethod = tx.deliveryMethod
    uplift.fuelType = tx.fuelType

    uplift.supplyChainRequest = tx.supplyChainRequest
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

    var scr = factory.newResource(NS, 'SupplyAgreement', SAID)

    scr.volume = tx.volume
    scr.comencementDate = tx.comencementDate
    scr.expiryDate = tx.expiryDate
    scr.customer = tx.customer
    scr.distributor = tx.distributor
    scr.tractionSites = tx.tractionSites
    scr.homebaseSites = tx.homebaseSites
    scr.rebateTable = tx.rebateTable
    return registry.add(scr)
}

/**
 * add supply chain request transaction
 * @param {org.catena.addSupplyChainRequest} tx
 * @transaction
 */
async function addSupplyChainRequest (tx) {
    const registry = await getAssetRegistry('org.catena.SupplyAgreement')

    if(typeof tx.supplyAgreement.supplyChainRequests === 'undefined'){
        tx.supplyAgreement.supplyChainRequests = [tx.supplyChainRequest]
    }else{
        tx.supplyAgreement.supplyChainRequests = [...tx.supplyAgreement.supplyChainRequests, tx.supplyChainRequest]
    }
    registry.update(tx.supplyAgreement)
}
