import React, { Component, Fragment } from "react";
import { Row } from "reactstrap";
import { Auth } from "aws-amplify";

import axios from "axios";
import client from "../../../queries/client";
import fetchOrders from "../../../queries/fetchOrders";
import { servicePath } from "../../../constants/defaultValues";
import DataListView from "../../../containers/pages/DataListView";
import Pagination from "../../../containers/pages/Pagination";
import ContextMenuContainer from "../../../containers/pages/ContextMenuContainer";
import ListPageHeading from "../../../containers/pages/ListPageHeading";
import ImageListView from "../../../containers/pages/ImageListView";
import ThumbListView from "../../../containers/pages/ThumbListView";
import AddNewModal from "../../../containers/pages/AddNewModal";
import { SubscriptionClient } from "subscriptions-transport-ws";
import gql from "graphql-tag";

function collect(props) {
  return { data: props.data };
}
const apiUrl = servicePath + "/cakes/paging";

const GRAPHQL_ENDPOINT = "wss://arokiya.7zero.com/v1/graphql";

const wsclient = new SubscriptionClient(GRAPHQL_ENDPOINT, {
  reconnect: true,
  connectionParams: {
    headers: {
      "x-hasura-admin-secret": "9J8q3FCeFH63Rzqb"
    }
  }
});

class Orders extends Component {
  constructor(props) {
    super(props);
    this.mouseTrap = require("mousetrap");
    this.startSubscription = false;
    this.state = {
      displayMode: "list",
      orders: [],
      selectedPageSize: 10,
      orderOptions: [
        { column: "title", label: "Product Name" },
        { column: "category", label: "Category" },
        { column: "status", label: "Status" }
      ],
      pageSizes: 10,

      categories: [
        { label: "Cakes", value: "Cakes", key: 0 },
        { label: "Cupcakes", value: "Cupcakes", key: 1 },
        { label: "Desserts", value: "Desserts", key: 2 }
      ],

      selectedOrderOption: { column: "title", label: "Product Name" },
      dropdownSplitOpen: false,
      modalOpen: false,
      currentPage: 1,
      totalItemCount: 0,
      totalPage: 1,
      search: "",
      ordersCount: 0,
      selectedItems: [],
      lastChecked: null,
      isLoading: false
    };
  }
  componentDidMount() {
    this.dataListRender();
    this.mouseTrap.bind(["ctrl+a", "command+a"], () =>
      this.handleChangeSelectAll(false)
    );
    this.mouseTrap.bind(["ctrl+d", "command+d"], () => {
      this.setState({
        selectedItems: []
      });
      return false;
    });
    this.fetchOrders();
    wsclient
      .request({
        query: gql`
          subscription {
            order(
              where: { reference: { _is_null: false } }
              order_by: { createdAt: desc }
              limit: 1
            ) {
              id
              createdAt
              total
            }
          }
        `
      })
      .subscribe({
        next: result => {
          if (this.startSubscription) {
            // console.log(result)
            this.showBrowserNotification();
            this.props.changeOpenSnackBar();
            this.fetchOrders();
          } else {
            this.startSubscription = true;
          }
        },
        complete: () => {
          console.log("completed");
        },
        error: error => {
          console.log(error);
        }
      });
  }

  fetchOrders = () => {
    Auth.currentAuthenticatedUser()
      .then(res => {
        const shopId = res.attributes["custom:shopId"];
        console.log(shopId);
        const query = fetchOrders(shopId);
        client(query)
          .then(res => {
            console.log("resres", res);
            this.setState({
              orders: res.data.order,
              ordersCount: res.data.order.length
            });
          })
          .catch(error => {
            console.log(error);
          });
      })
      .catch(console.log);
  };

  componentWillUnmount() {
    this.mouseTrap.unbind("ctrl+a");
    this.mouseTrap.unbind("command+a");
    this.mouseTrap.unbind("ctrl+d");
    this.mouseTrap.unbind("command+d");
  }

  toggleModal = product => {
    this.setState({
      modalOpen: !this.state.modalOpen,
      selectedOrder: product
    });
  };

  handleClose = () => {
    this.setState({ modalOpen: false, selectedOrder: null });
  };

  changeOrderBy = column => {
    this.setState(
      {
        selectedOrderOption: this.state.orderOptions.find(
          x => x.column === column
        )
      },
      () => this.dataListRender()
    );
  };
  changePageSize = size => {
    this.setState(
      {
        selectedPageSize: size,
        currentPage: 1
      },
      () => this.dataListRender()
    );
  };
  changeDisplayMode = mode => {
    this.setState({
      displayMode: mode
    });
    return false;
  };
  onChangePage = page => {
    console.log("page", page);
    this.setState(
      {
        currentPage: page
      },
      () => this.fetchOrders()
    );
  };

  onSearchKey = e => {
    if (e.key === "Enter") {
      this.setState(
        {
          search: e.target.value.toLowerCase()
        },
        () => this.dataListRender()
      );
    }
  };

  onCheckItem = (event, id) => {
    if (
      event.target.tagName === "A" ||
      (event.target.parentElement && event.target.parentElement.tagName === "A")
    ) {
      return true;
    }
    if (this.state.lastChecked === null) {
      this.setState({
        lastChecked: id
      });
    }

    let selectedItems = this.state.selectedItems;
    if (selectedItems.includes(id)) {
      selectedItems = selectedItems.filter(x => x !== id);
    } else {
      selectedItems.push(id);
    }
    this.setState({
      selectedItems
    });

    if (event.shiftKey) {
      var items = this.state.items;
      var start = this.getIndex(id, items, "id");
      var end = this.getIndex(this.state.lastChecked, items, "id");
      items = items.slice(Math.min(start, end), Math.max(start, end) + 1);
      selectedItems.push(
        ...items.map(item => {
          return item.id;
        })
      );
      selectedItems = Array.from(new Set(selectedItems));
      this.setState({
        selectedItems
      });
    }
    document.activeElement.blur();
  };

  getIndex(value, arr, prop) {
    for (var i = 0; i < arr.length; i++) {
      if (arr[i][prop] === value) {
        return i;
      }
    }
    return -1;
  }
  handleChangeSelectAll = isToggle => {
    if (this.state.selectedItems.length >= this.state.items.length) {
      if (isToggle) {
        this.setState({
          selectedItems: []
        });
      }
    } else {
      this.setState({
        selectedItems: this.state.items.map(x => x.id)
      });
    }
    document.activeElement.blur();
    return false;
  };

  dataListRender() {
    const {
      selectedPageSize,
      currentPage,
      selectedOrderOption,
      search
    } = this.state;
    axios
      .get(
        `${apiUrl}?pageSize=${selectedPageSize}&currentPage=${currentPage}&orderBy=${selectedOrderOption.column}&search=${search}`
      )
      .then(res => {
        console.log("data res", res);
        return res.data;
      })
      .then(data => {
        this.setState({
          // totalPage: data.totalPage,
          items: data.data,
          selectedItems: [],
          totalItemCount: data.totalItem,
          isLoading: true
        });
      });
  }

  onContextMenuClick = (e, data, target) => {
    console.log(
      "onContextMenuClick - selected items",
      this.state.selectedItems
    );
    console.log("onContextMenuClick - action : ", data.action);
  };

  onContextMenu = (e, data) => {
    const clickedProductId = data.data;
    if (!this.state.selectedItems.includes(clickedProductId)) {
      this.setState({
        selectedItems: [clickedProductId]
      });
    }

    return true;
  };

  render() {
    const {
      currentPage,
      items,
      displayMode,
      selectedPageSize,
      totalItemCount,
      selectedOrderOption,
      selectedItems,
      totalPage,
      orderOptions,
      pageSizes,
      modalOpen,
      ordersCount,
      categories
    } = this.state;
    const { match } = this.props;
    const startIndex = (currentPage - 1) * selectedPageSize;
    const endIndex = currentPage * ordersCount;
    const totalPageSize = Math.ceil(ordersCount / pageSizes);
    console.log("total", totalPageSize);
    const orders = this.state.orders;
    return !this.state.isLoading ? (
      <div className="loading" />
    ) : (
      <Fragment>
        <div className="disable-text-selection">
          <ListPageHeading
            heading="menu.orders"
            displayMode={displayMode}
            changeDisplayMode={this.changeDisplayMode}
            handleChangeSelectAll={this.handleChangeSelectAll}
            changeOrderBy={this.changeOrderBy}
            changePageSize={this.changePageSize}
            selectedPageSize={selectedPageSize}
            // totalItemCount={totalItemCount}
            ordersCount={ordersCount}
            selectedOrderOption={selectedOrderOption}
            match={match}
            startIndex={startIndex}
            endIndex={endIndex}
            selectedItemsLength={selectedItems ? selectedItems.length : 0}
            itemsLength={this.state.orders ? this.state.orders.length : 0}
            onSearchKey={this.onSearchKey}
            orderOptions={orderOptions}
            pageSizes={pageSizes}
            toggleModal={this.toggleModal}
          />
          {console.log("sel", this.state.selectedOrder)}
          {this.state.selectedOrder && (
            <AddNewModal
              modalOpen={modalOpen}
              toggleModal={this.toggleModal}
              categories={categories}
              order={this.state.selectedOrder}
              onClose={this.handleClose}
            />
          )}
          <Row>
            {this.state.orders.map(product => {
              // console.log("items",this.state.items)
              // console.log("orders",this.state.orders)
              if (this.state.displayMode === "imagelist") {
                return (
                  <ImageListView
                    key={product.id}
                    product={product}
                    isSelect={this.state.selectedItems.includes(product.id)}
                    collect={collect}
                    onCheckItem={this.onCheckItem}
                  />
                );
              } else if (this.state.displayMode === "thumblist") {
                return (
                  <ThumbListView
                    key={product.id}
                    product={product}
                    isSelect={this.state.selectedItems.includes(product.id)}
                    collect={collect}
                    onCheckItem={this.onCheckItem}
                  />
                );
              } else {
                return (
                  <DataListView
                    key={product.id}
                    product={product}
                    isSelect={this.state.selectedItems.includes(product.id)}
                    onCheckItem={this.onCheckItem}
                    collect={collect}
                    toggleModal={() => this.toggleModal(product)}
                    order={this.state.selectedOrder}
                  />
                );
              }
            })}{" "}
            <Pagination
              currentPage={this.state.currentPage}
              totalPage={totalPageSize}
              onChangePage={i => this.onChangePage(i)}
            />
            {/* <ContextMenuContainer
              onContextMenuClick={this.onContextMenuClick}
              onContextMenu={this.onContextMenu}
            /> */}
          </Row>
        </div>
      </Fragment>
    );
  }
}
export default Orders;
